# Okta and AWS in the Browser

The sample application below authenticates users using [web identity
federation](http://docs.aws.amazon.com/STS/latest/UsingSTS/web-identity-federation.html) and Okta. After logging in, the user will get
temporary AWS credentials and assume the pre-specified [IAM (AWS
Identity and Access Management)](http://docs.aws.amazon.com/IAM/latest/UserGuide/roles-toplevel.html) role whose policy allows uploading
and listing objects in [Amazon S3](http://aws.amazon.com/s3/).

This guide is designed to walk readers through integrating an
AWS-backed JavaScript web application with a third-party identity
provider, setting up properly scoped permissions for federated access
to AWS APIs, and basic usage of the AWS SDK for JavaScript.

## NOTE!

As of 2016-11-11, this sample code will *not* work. AWS requires
that Okta publish [the `x5c` parameter](https://tools.ietf.org/html/rfc7517#section-4.7) in the `jwks_uri`, which Okta
does not currently do.

If you need to get this working, please write up your usecase and
send it to:
-   Joël Franusic <joel.franusic@okta.com>
-   Karl McGuinness <kmcguinness@okta.com>

## Create an Amazon S3 bucket and configure CORS

[CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing) needs to be configured on the Amazon S3 bucket to be accessed
directly from JavaScript in the browser.

1.  Navigate to the [Amazon S3 console](https://console.aws.amazon.com/s3/home).
2.  Choose an existing bucket or create a new bucket if
    desired. Note the bucket name and bucket region for later use in
    the application.
3.  Click the **Properties** tab, open the **Permissions** section, and
    click **Edit CORS Configuration**.
4.  Copy the below XML into the text box and click **Save**.

&nbsp;

    <?xml version="1.0" encoding="UTF-8"?>
    <CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01">
       <CORSRule>
          <AllowedOrigin>*</AllowedOrigin>
          <AllowedMethod>GET</AllowedMethod>
          <AllowedMethod>PUT</AllowedMethod>
          <AllowedMethod>POST</AllowedMethod>
          <AllowedMethod>DELETE</AllowedMethod>
          <AllowedHeader>*</AllowedHeader>
       </CORSRule>
    </CORSConfiguration>

## Calculate a "thumprint" to give to AWS

You will need to generate a "thumbprint" for AWS to use to validate
`id_tokens`
For AWS to validate an OIDC `id_token` from Okta, you need to give
AWS the "thumbprint" of the x509 certificate from the `x5c`
parameter in the `jwks_uri`, this thumprint is the SHA1 hash of the
DER encoded x509 certificate that contains the public key which
will be used to validate `id_tokens` from Okta.

By default AWS assumes that the private key used by the HTTPS server
on the domain from which a JWT is issued is the same private key
that is used to sign the JWTs.

Here is how AWS generates a thumbprint for the HTTPS server:
<http://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc_verify-thumbprint.html>

To verify the thumbprint that you see, you can run this command:

    domain="example.okta.com"
    (echo "" | openssl s_client -showcerts -connect $domain:443 2> /dev/null) | grep -A27 -- '-----BEGIN CERTIFICATE-----' | tail -28 | \
    openssl x509 -fingerprint -noout | \
    cut -d '=' -f 2 | \
    tr -d ':' | \
    tr '[:upper:]' '[:lower:]'

    a031c46782e6e6c662c2c87c76da9aa62ccabd8e

However, Okta does *not* sign our JWTs or `id_tokens` using the
same private key as we use for HTTPS/TLS, we generate a different
keypair to sign our JWTs, this keypair is different for each Okta
Org, and will eventually be rotated on a regular basis.

Below is how to configure an AWS IAM OIDC Identity Provider to with the
correct thumbprint for validating OIDC `id_token` s from Okta.

To do this, we do the following:
1.  Get the `jwks_uri` from the `/.well-known/openid-configuration`
    endpoint for our Okta org. (AWS will fetch this URL the first
    time that you configure an Identity Provider in AWS/IAM.
2.  Pull out the first x509 certificate from the first key using the
    jq expression `.keys[0].x5c[0]`
3.  Remove the quote character from the string using `tr`
4.  Base64 decode the string and pass to `openssl`, asking `openssl`
    to give us the fingerprint for that key, telling
    `openssl` that the input is a DER encoded x509 certificate
5.  Use `cut` and `tr` to clean up the format of the fingerprint
    suitable for pasting into AWS.

If the `x5c` parameter is included in the `jwks_uri`, then you will
be able to use this command below to generate a thumbprint for the
x509 certificate.

    domain="example.okta.com"
    jwks_uri=`curl -s https://${domain}/.well-known/openid-configuration | jq -r .jwks_uri`;
    curl -s $jwks_uri | \
        jq '.keys[0].x5c[0]' | \
        tr -d '"' | \
        base64 -D | \
        openssl x509 -inform DER -fingerprint -noout | \
        cut -d '=' -f 2 | \
        tr -d ':' | \
        tr '[:upper:]' '[:lower:]'


Once we've configured the Identity Provider with the thumbprint,
AWS will be able to validate an `id_token` from Okta.

## Create an Okta OIDC App and get the Client ID for that app

You will need to create an OIDC App in Okta, then copy the Client
ID.

FIXME: This will need to be updated if this document is ever made public.

## Create an IAM Role and Assign Users Logged in through Okta

1.  Go to the **Policies** section of the [IAM console](https://console.aws.amazon.com/iam/home#policies) and click
    **Create Policy → Create Your Own Policy**.
2.  Name your policy (e.g. `OktaSample`), copy the JSON policy
    below to the **Policy Document** text box, and replace the two
    instances of `YOUR_BUCKET_NAME` with your actual bucket name, and
    click **Create Policy**.
3.  Now go to the **Roles** section of the IAM console and click
    **Create New Role**
4.  Name your role and select
    **Role for Identity Provider Access → Grant access to web identity providers.**
5.  FIXME: Select Facebook and type in your Facebook App ID.
6.  Click Next Step on Verify Role Trust.
7.  On the **Attach Policy** step, select the policy you just created,
    and click **Next Step**, then **Create Role** on the next page.

&nbsp;

    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": [
                    "s3:PutObject",
                    "s3:PutObjectAcl"
                ],
                "Resource": [
                    "arn:aws:s3:::YOUR_BUCKET_NAME/okta-${cognito-identity.amazonaws.com:sub}/*"
                ],
                "Effect": "Allow"
            },
            {
                "Action": [
                    "s3:ListBucket"
                ],
                "Resource": [
                    "arn:aws:s3:::YOUR_BUCKET_NAME"
                ],
                "Effect": "Allow",
                "Condition": {
                    "StringEquals": {
                        "s3:prefix": "okta-${cognito-identity.amazonaws.com:sub}"
                    }
                }
            }
        ]
    }

## Create a sample.html File Containing the Code Below

Before you can run the example, you need to replace '**YOUR\_APP\_ID**',
'**YOUR\_ROLE\_ARN**', '**YOUR\_BUCKET\_NAME**', and '**YOUR\_BUCKET\_REGION**' with
appropriate values. [Region](http://docs.aws.amazon.com/general/latest/gr/rande.html) takes the form of '*us-east-1*' (US
Standard), '*us-west-2*' (Oregon), etc. The ARN (Amazon Resource
Name) of your IAM role can be found in the [IAM console](https://console.aws.amazon.com/iam/home?#roles) by selecting
your role and opening the **Summary** tab.

    <!DOCTYPE html>
    <html>
      <head>
        <title>AWS and Okta - Sample Application</title>
        <script src="//sdk.amazonaws.com/js/aws-sdk-2.3.7.js"></script>
        <script src="/js/okta-sign-in.min.js" type="text/javascript"></script>
        <link href="/css/okta-sign-in.min.css" type="text/css" rel="stylesheet">
        <link href="/css/okta-theme.css" type="text/css" rel="stylesheet">
      </head>
      <body>
        <div id="okta-login-container"></div>
        <div id="upload-dialog" style="display:none">
          <input type="file" id="file-chooser" />
          <button id="upload-button" style="display:block">Upload to S3</button>
        </div>
        <div id="results"></div>
        <script type="text/javascript">
          // e.g.: example.okta.com
          var AWS_OIDC_PROVIDER_URL = 'YOUR_OIDC_PROVIDER_URL';
          // This tells Cognito which Cognito identity pool to use
          // e.g.: us-east-1:0a1bc234-567d-89e0-1fg2-hi34jk5lm678
          var AWS_IDENTITY_POOL_ID = 'YOUR_AWS_IDENTITY_POOL_ID';
          // e.g.: example-s3-bucket
          var AWS_S3_BUCKET_NAME = 'YOUR_S3_BUCKET_NAME';

          // e.g.: https://example.okta.com
          var OKTA_ORG_URL = 'YOUR_OKTA_ORG_URL';
          // e.g.: aBCdEf0GhiJkLMno1pq2
          var OKTA_CLIENT_ID = 'YOUR_OKTA_APP_CLIENT_ID';

          AWS.config.region = AWS_IDENTITY_POOL_ID.split(':')[0];
          AWS.config.logger = console;

          var oktaUserId;
          var bucket;

          var fileChooser = document.getElementById('file-chooser');
          var button = document.getElementById('upload-button');
          var results = document.getElementById('results');
          var oktaLoginContainer = document.getElementById('okta-login-container');
          var uploadDialog = document.getElementById('upload-dialog');

          button.addEventListener('click', function () {
              var file = fileChooser.files[0];
              if (file) {
                  results.innerHTML = '';
                  // e.g.: "okta-us-east-1:01a23bcd-e456-7f8g-9012-h345i6789jkl/Ajax-loader.gif"
                  var objKey = 'okta-' + oktaUserId + '/' + file.name;
                  var params = {
                      Key: objKey,
                      ContentType: file.type,
                      Body: file,
                      ACL: 'public-read'
                  };
                  bucket.putObject(params, function (err, data) {
                      if (err) {
                          results.innerHTML = 'ERROR: ' + err;
                      } else {
                          listObjs();
                      }
                  });
              } else {
                  results.innerHTML = 'Nothing to upload.';
              }
          }, false);

          function listObjs() {
              var prefix = 'okta-' + oktaUserId;
              bucket.listObjects({ Prefix: prefix }, function (err, data) {
                  if (err) {
                      results.innerHTML = 'ERROR: ' + err;
                  } else {
                      var objKeys = "";
                      data.Contents.forEach(function (obj) {
                          objKeys += obj.Key + "<br>";
                      });
                      results.innerHTML = objKeys;
                  }
              });
          }

          var oktaSignIn = new OktaSignIn({
              authParams: {
                  responseType: 'id_token',
                  responseMode: 'okta_post_message',
                  scopes: ['openid', 'groups']
              },
              clientId: OKTA_CLIENT_ID,
              baseUrl: OKTA_ORG_URL
          });

          oktaSignIn.renderEl(
              { el: '#okta-login-container' },
              function (res) {
                  if (res.status === 'SUCCESS') {
                      console.log('User successfully authenticated');
                      console.log(res);
                      var logins = {};
                      logins[AWS_OIDC_PROVIDER_URL] = res.idToken;
                      AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                          IdentityPoolId: AWS_IDENTITY_POOL_ID,
                          Logins: logins
                      });
                      AWS.config.credentials.get(function(err) {
                          if (err) {
                              console.log("Error creating Cognito identity: " + err);
                              return;
                          }
                          bucket = new AWS.S3({
                              params: {
                                  Bucket: AWS_S3_BUCKET_NAME
                              }
                          });
                          oktaUserId = AWS.config.credentials.identityId;
                          oktaLoginContainer.style.display = 'none';
                          uploadDialog.style.display = 'block';
                          listObjs();
                      });
                  } else {
                      console.log('Login status is not "SUCCESS"');
                      console.log(res);
                  }
              }
          );
        </script>
      </body>
    </html>

## Run the Sample

    http://YOUR_DOMAIN/sample.html

## About the Sample

This sample application is designed to show you how to:
-   Use the AWS Web Identity Federation and Facebook login to
    authenticate users.
-   Assign user-specific write permissions at the prefix level with
    IAM role policy so that users can't overwrite or change other
    users' objects.
-   Instantiate an [Amazon Simple Storage Service (Amazon S3)](https://aws.amazon.com/s3/) client.
-   Use **<input type="file" />** tag that calls the browser's native
    file interface, and upload the chosen file to an Amazon S3
    bucket, with 'public-read' permissions.

## Additional Resources

For in-depth user guides, API documentation, developer forums, and
other developer resources, see the AWS SDK for JavaScript in the
Browser page.

FIXME: Add links to Okta resources too.

# Code

This sample consists of two logical components:
1.  The HTML for a sample Single Page Application
2.  The JavaScript that powers this sample Single Page Application

## sample.html

The HTML for this sample is below. By default we show the Okta
Sign-In Widget and hide the `upload-dialog` `<div>` with the
buttons for uploading files to S3.

After a successful login, we will hide the Okta Sign-In Widget and
show the `upload-dialog` `<div>`.

The JavaScript that powers this sample is covered in the next section.

    <!DOCTYPE html>
    <html>
      <head>
        <title>AWS and Okta - Sample Application</title>
        <script src="//sdk.amazonaws.com/js/aws-sdk-2.3.7.js"></script>
        <script src="/js/okta-sign-in.min.js" type="text/javascript"></script>
        <link href="/css/okta-sign-in.min.css" type="text/css" rel="stylesheet">
        <link href="/css/okta-theme.css" type="text/css" rel="stylesheet">
      </head>
      <body>
        <div id="okta-login-container"></div>
        <div id="upload-dialog" style="display:none">
          <input type="file" id="file-chooser" />
          <button id="upload-button" style="display:block">Upload to S3</button>
        </div>
        <div id="results"></div>
        <script type="text/javascript">
          <<sample-javascript>>
        </script>
      </body>
    </html>

## JavaScript for sample.html

The most important part of this sample is the configuration
variables for AWS and Okta.

For AWS, we need the following:
1.  The **domain name** for an **OIDC provider**.

    This is the domain name for the Okta org that you are connecting
    to AWS. It will look something like "example.okta.com" or
    "example.oktapreview.com"

2.  An **AWS Identity Pool**.

    This Identity Pool must be configured so that users which
    succesfullly authenticate into the identity pool will have
    approprate permissions to read and write to the S3 bucket below.

    Configuration for this Identity Pool are above.

3.  An **S3 Bucket**.

The JavaScript in `sample.html` is described below.

The variables below are needed to configure the AWS JS SDK:

    // e.g.: example.okta.com
    var AWS_OIDC_PROVIDER_URL = 'YOUR_OIDC_PROVIDER_URL';
    // This tells Cognito which Cognito identity pool to use
    // e.g.: us-east-1:0a1bc234-567d-89e0-1fg2-hi34jk5lm678
    var AWS_IDENTITY_POOL_ID = 'YOUR_AWS_IDENTITY_POOL_ID';
    // e.g.: example-s3-bucket
    var AWS_S3_BUCKET_NAME = 'YOUR_S3_BUCKET_NAME';

The variables below are needed to configure the Okta Sign-In widget:

    // e.g.: https://example.okta.com
    var OKTA_ORG_URL = 'YOUR_OKTA_ORG_URL';
    // e.g.: aBCdEf0GhiJkLMno1pq2
    var OKTA_CLIENT_ID = 'YOUR_OKTA_APP_CLIENT_ID';

This code initializes the AWS JavaScript SDK. Note that the AWS
region is derived from the AWS Identity Pool ID, which might not be
what you want!

We also configure the SDK to send logging information to the
JavaScript console.

    AWS.config.region = AWS_IDENTITY_POOL_ID.split(':')[0];
    AWS.config.logger = console;

The variables below are global variables that are used to
communicate between the various event handlers and callbacks in
this example.

`oktaUserId` is set after a user sucessfully authenticates with the
Okta Sign-In Widget.

`bucket` is used to pass S3 bucket information between the
authentication code, the function that lists the contents of the
bucket, and the function which handles click events on the "Upload
to S3" button.

    var oktaUserId;
    var bucket;

The variables below are selectors for the various HTML elements
that are used in this sample.

    var fileChooser = document.getElementById('file-chooser');
    var button = document.getElementById('upload-button');
    var results = document.getElementById('results');
    var oktaLoginContainer = document.getElementById('okta-login-container');
    var uploadDialog = document.getElementById('upload-dialog');

This code sets up a event listener for the "Upload to S3"
button. The "Upload to S3" button is hidden until a user has
succesfully authentiated against Okta and AWS Cognito. Note the use
of the `bucket` global variable, which is only populated after a
user sucessfully authenticates.

    button.addEventListener('click', function () {
        var file = fileChooser.files[0];
        if (file) {
            results.innerHTML = '';
            // e.g.: "okta-us-east-1:01a23bcd-e456-7f8g-9012-h345i6789jkl/Ajax-loader.gif"
            var objKey = 'okta-' + oktaUserId + '/' + file.name;
            var params = {
                Key: objKey,
                ContentType: file.type,
                Body: file,
                ACL: 'public-read'
            };
            bucket.putObject(params, function (err, data) {
                if (err) {
                    results.innerHTML = 'ERROR: ' + err;
                } else {
                    listObjs();
                }
            });
        } else {
            results.innerHTML = 'Nothing to upload.';
        }
    }, false);

This function is called after a successful user authentication. It
lists all of the S3 objects that a user has permision to see. Note
that our S3 policy only allows users to see files that the
uploaded. These users are scoped to an S3 `Prefix` which contains
their user id.

    function listObjs() {
        var prefix = 'okta-' + oktaUserId;
        bucket.listObjects({ Prefix: prefix }, function (err, data) {
            if (err) {
                results.innerHTML = 'ERROR: ' + err;
            } else {
                var objKeys = "";
                data.Contents.forEach(function (obj) {
                    objKeys += obj.Key + "<br>";
                });
                results.innerHTML = objKeys;
            }
        });
    }

This code sets up `oktaSignIn` to be an instance of the
`OktaSignIn` widget. The `authParams` are telling the Okta Sign-In
Widget that we want an OIDC `id_token`, that will use the
`okta_post_message` response mode to communicate with Okta. The
`openid` scope is needed to get an OIDC response. The `groups`
scope tells Okta to include a user's groups in the OIDC `id_token`.

    var oktaSignIn = new OktaSignIn({
        authParams: {
            responseType: 'id_token',
            responseMode: 'okta_post_message',
            scopes: ['openid', 'groups']
        },
        clientId: OKTA_CLIENT_ID,
        baseUrl: OKTA_ORG_URL
    });

Finally, we initialize the Okta Sign-In Widget. For the purposes of
this example, we only hand the "SUCCESS" state. You would want to
handle the other states in production code.

See below for details on the code that is run on the "SUCCESS" state.

    oktaSignIn.renderEl(
        { el: '#okta-login-container' },
        function (res) {
            if (res.status === 'SUCCESS') {
                console.log('User successfully authenticated');
                console.log(res);
                var logins = {};
                logins[AWS_OIDC_PROVIDER_URL] = res.idToken;
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: AWS_IDENTITY_POOL_ID,
                    Logins: logins
                });
                AWS.config.credentials.get(function(err) {
                    if (err) {
                        console.log("Error creating Cognito identity: " + err);
                        return;
                    }
                    bucket = new AWS.S3({
                        params: {
                            Bucket: AWS_S3_BUCKET_NAME
                        }
                    });
                    oktaUserId = AWS.config.credentials.identityId;
                    oktaLoginContainer.style.display = 'none';
                    uploadDialog.style.display = 'block';
                    listObjs();
                });
            } else {
                console.log('Login status is not "SUCCESS"');
                console.log(res);
            }
        }
    );

Upon a successful login, we log the value of the Okta user resource
"`res`" to the JavaScript `console` and then use the OIDC id\_token
(`res.idToken`) to configure the Cognito Identity Credentials object.

    console.log('User successfully authenticated');
    console.log(res);
    var logins = {};
    logins[AWS_OIDC_PROVIDER_URL] = res.idToken;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: AWS_IDENTITY_POOL_ID,
        Logins: logins
    });

Once we have configured the `AWS.config.credentials` object, we
call the `.get()` method to use authenticate against Cognito using
the OIDC id\_token we got from Okta.

After checking for an error (`err`), we do the following:
-   Define an AWS S3 `bucket` object for other parts of the example
    to use
    FIXME: Why here?
-   Configure the `oktaUserId` global
-   Hide the Okta Sign-In Widget (`oktaLoginContainer`)
-   Show the buttons for selecting a file and uploading it to S3 (`uploadDialog`)
-   List any objects that the user might have uploaded previously.

FIXME: Determine why we aren't doing this:
`oktaUserId = res.claims.sub;`

    AWS.config.credentials.get(function(err) {
        if (err) {
            console.log("Error creating Cognito identity: " + err);
            return;
        }
        bucket = new AWS.S3({
            params: {
                Bucket: AWS_S3_BUCKET_NAME
            }
        });
        oktaUserId = AWS.config.credentials.identityId;
        oktaLoginContainer.style.display = 'none';
        uploadDialog.style.display = 'block';
        listObjs();
    });
