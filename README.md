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

## BETA

Note, these instructions require that your Okta Org is part of the
**OpenID Connect Beta**. If you do not have the ability to create
OpenID Connect apps in your Okta org, please contact Okta Support
and ask that the `OPENID_CONNECT` flag be enabled on your Okta org.

## Create an Okta OIDC App and get the Client ID for that app

You will need an OpenID Connect app in Okta for this sample
application. You can create an OpenID Connect app as follows:

1.  Log in to your Okta org
2.  After loggin in, click on the "Admin" button on the upper right
    of the screen.
3.  Select "Add Applications" from the "Shortcuts" section on the
    right side of the screen.
4.  Click the "Create New App" button on the left side of the
    screen.
5.  Set the "Platform" to: "Single Plage App (SPA)", click the
    "Create" button.
6.  Name the application (e.g. `AWS Example`), click the "Next" button.
7.  Click "Add URI" and add the `http://localhost:8000/sample.html`
          URI, then click the "Finish" button.
8.  Click on the "People" section, click "Assign to People", click
    the "Assign" button next to your username, click "Save and Go
    Back", click "Done" - **Important:** only users assigned to this
    app will be able to authenticate!
9.  Click on the "General" section, scroll down and make note of the
    "**Client ID**", you will use this when you configure AWS.

## Set up CORS in Okta

This sample application also requires that you enable CORS in Okta,
do this as follows.

1.  From the "Security" menu in the Admin interface, select the
    "API" option.
2.  Click on the "CORS" tab in the API screen.
3.  Click the "Edit" button, make sure the "Enable CORS &#x2026;" option
    is selected, enter `http://localhost:8000` into the text field,
    then click the "Save" button.

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

## Create an IAM OpenID Connect Provider

1.  Go to the **Identity Providers** section of the [IAM console](https://console.aws.amazon.com/iam/home#policies) and
    click the "Create Provider" button, select "OpenID Connect",
    enter your Okta org URL as the **Provider URL**
    (e.g. `https://example.okta.com`), enter your Okta app *Client ID* as the
    **Audience**, click "Next Step"
2.  Click "Create" to skip the "Verify Provider Information" instructions.
    *This step is for OIDC providers that sign their OIDC tokens*
    *using the private key from their HTTPS/TLS certificate. Okta*
    *signs OIDC tokens using different keys*

## Create an IAM Role and Assign Users Logged in through Okta

1.  Go to the **Policies** section of the [IAM console](https://console.aws.amazon.com/iam/home#policies) and click
    **Create Policy → Create Your Own Policy**.
2.  Name your policy (e.g. `OktaSample`), copy the JSON policy
    below to the **Policy Document** text box, and replace the two
    instances of `YOUR_BUCKET_NAME` with your actual bucket name, and
    click **Create Policy**.
3.  Now go to the **Roles** section of the IAM console and click
    **Create New Role**
4.  Name your role (e.g. `OktaSampleRole`) and select
    **Role for Identity Provider Access → Grant access to web identity providers.**
5.  Select your Okta org from the **Identity Provider** dropdown and
    click "Next Step"
6.  Click "Next Step" on Verify Role Trust.
7.  On the **Attach Policy** step, select the policy you just created
    (e.g. `OktaSample`), and click **Next Step**, then **Create Role**
    on the next page.
8.  **Important:** Make sure that you replace `YOUR_BUCKET_NAME` and
    `YOUR_OIDC_PROVIDER_URL` in the policy!

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
                    "arn:aws:s3:::YOUR_BUCKET_NAME/okta-${YOUR_OIDC_PROVIDER_URL:sub}/*"
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
                        "s3:prefix": "okta-${YOUR_OIDC_PROVIDER_URL:sub}"
                    }
                }
            }
        ]
    }

> If you are wondering, this policy uses [IAM Policy Variables](http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html) to
> restricts listing only the files that they have uploaded.

## Create a sample.html file containing the code below

Before you can run the example, you need to replace the variables
below with the approprate variables for your system:
-   YOUR\_OIDC\_PROVIDER\_URL
-   YOUR\_AWS\_ROLE\_ARN

    The ARN (Amazon Resource Name) of your IAM role can be found in
    the [IAM console](https://console.aws.amazon.com/iam/home?#roles) by selecting your role and opening the **Summary**
    tab.

-   YOUR\_AWS\_REGION

    [Region](http://docs.aws.amazon.com/general/latest/gr/rande.html) takes the form of '*us-east-1*' (US Standard),
    '*us-west-2*' (Oregon), etc.

-   YOUR\_S3\_BUCKET\_NAME
-   YOUR\_OKTA\_ORG\_URL
-   YOUR\_OKTA\_APP\_CLIENT\_ID

&nbsp;

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
          // e.g.: arn:aws:iam::123456789012:role/OktaSampleRole
          var AWS_ROLE_ARN = 'YOUR_AWS_ROLE_ARN';
          // e.g.: us-east-1
          var AWS_REGION = 'YOUR_AWS_REGION';
          // e.g.: example-s3-bucket
          var AWS_S3_BUCKET_NAME = 'YOUR_S3_BUCKET_NAME';

          // e.g.: https://example.okta.com
          var OKTA_ORG_URL = 'YOUR_OKTA_ORG_URL';
          // e.g.: aBCdEf0GhiJkLMno1pq2
          var OKTA_CLIENT_ID = 'YOUR_OKTA_APP_CLIENT_ID';

          AWS.config.region = AWS_REGION;
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
                  // e.g.: "okta-00u0abcd1eFghIJKl2m3/Ajax-loader.gif"
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
                      oktaUserId = res.claims.sub;
                      AWS.config.credentials = new AWS.WebIdentityCredentials({
                          RoleArn: AWS_ROLE_ARN,
                          WebIdentityToken: res.idToken
                      });
                      AWS.config.credentials.get(function(err) {
                          if (err) {
                              console.log("Error creating AWS Web Identity: " + err);
                              return;
                          }
                          bucket = new AWS.S3({
                              params: {
                                  Bucket: AWS_S3_BUCKET_NAME
                              }
                          });
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

Start a webserver on your server on port 8000 and visit
<http://localhost:8000/sample.html>

If you are on Mac OS X or Linux, you can use Python to
start a webserver for you: `cd` to the directory where
`sample.html` is located, then run this command:

    python -m SimpleHTTPServer 8000

## About the Sample

This sample application is designed to show you how to:
-   Use the AWS Web Identity Federation and Okta to authenticate
    users.
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

# Code

This section describes the code used in this sample
application. You only need to read this if you want to learn more
about how the sample application works.

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

2.  An **AWS Role ARN**.

    The [Amazon Resource Name](http://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html) for the IAM Role that Okta users will
    be placed into.

3.  The **AWS Region** you've configured your IAM OpenID Connect
    Provider in.

4.  The **S3 Bucket** that yor AWS Role grants permissions to.

The JavaScript in `sample.html` is described below.

The variables below are needed to configure the AWS JS SDK:

    // e.g.: example.okta.com
    var AWS_OIDC_PROVIDER_URL = 'YOUR_OIDC_PROVIDER_URL';
    // e.g.: arn:aws:iam::123456789012:role/OktaSampleRole
    var AWS_ROLE_ARN = 'YOUR_AWS_ROLE_ARN';
    // e.g.: us-east-1
    var AWS_REGION = 'YOUR_AWS_REGION';
    // e.g.: example-s3-bucket
    var AWS_S3_BUCKET_NAME = 'YOUR_S3_BUCKET_NAME';

For Okta, we need the following:
1.  The Okta org URL
2.  The Client ID for the Okta app that users will be assigned to.

The variables below are needed to configure the Okta Sign-In widget:

    // e.g.: https://example.okta.com
    var OKTA_ORG_URL = 'YOUR_OKTA_ORG_URL';
    // e.g.: aBCdEf0GhiJkLMno1pq2
    var OKTA_CLIENT_ID = 'YOUR_OKTA_APP_CLIENT_ID';

This code initializes the AWS JavaScript SDK. We also configure the
SDK to send logging information to the JavaScript console.

    AWS.config.region = AWS_REGION;
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
succesfully authentiated against Okta and AWS. Note the use
of the `bucket` global variable, which is only populated after a
user sucessfully authenticates.

    button.addEventListener('click', function () {
        var file = fileChooser.files[0];
        if (file) {
            results.innerHTML = '';
            // e.g.: "okta-00u0abcd1eFghIJKl2m3/Ajax-loader.gif"
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
                oktaUserId = res.claims.sub;
                AWS.config.credentials = new AWS.WebIdentityCredentials({
                    RoleArn: AWS_ROLE_ARN,
                    WebIdentityToken: res.idToken
                });
                AWS.config.credentials.get(function(err) {
                    if (err) {
                        console.log("Error creating AWS Web Identity: " + err);
                        return;
                    }
                    bucket = new AWS.S3({
                        params: {
                            Bucket: AWS_S3_BUCKET_NAME
                        }
                    });
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

Upon a successful login, we do the following:
-   Log the value of the Okta user resource  "`res`" to the
    JavaScript `console`
-   Configure the `oktaUserId` global with the proper Okta User ID or
    "subject".
-   Use the OIDC id\_token (`res.idToken`) to configure a Web
    Identity Credentials object.

    console.log('User successfully authenticated');
    console.log(res);
    oktaUserId = res.claims.sub;
    AWS.config.credentials = new AWS.WebIdentityCredentials({
        RoleArn: AWS_ROLE_ARN,
        WebIdentityToken: res.idToken
    });

Once we have configured the `AWS.config.credentials` object, we
call the `.get()` method to use authenticate against AWS using
the OIDC id\_token we got from Okta.

After checking for an error (`err`), we do the following:
-   Define an AWS S3 `bucket` object in the context of a logged in
    user, for other parts of the example to use.
-   Hide the Okta Sign-In Widget (`oktaLoginContainer`)
-   Show the buttons for selecting a file and uploading it to S3 (`uploadDialog`)
-   List any objects that the user might have uploaded previously.

    AWS.config.credentials.get(function(err) {
        if (err) {
            console.log("Error creating AWS Web Identity: " + err);
            return;
        }
        bucket = new AWS.S3({
            params: {
                Bucket: AWS_S3_BUCKET_NAME
            }
        });
        oktaLoginContainer.style.display = 'none';
        uploadDialog.style.display = 'block';
        listObjs();
    });
