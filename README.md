- [Okta and AWS in the Browser](#org93fbff3)
- [Setting up Okta](#orga9564ed)
  - [Create an Okta OIDC App and get the Client ID for that app](#orga3b725e)
  - [Set up CORS in Okta](#orgd181b60)
- [Setting up AWS](#orgdb54a25)
  - [Create an Amazon S3 bucket and configure CORS](#org7dd9bf7)
  - [Create an IAM OpenID Connect Provider](#orgfdaed95)
  - [Create an IAM Role and Assign Users Logged in through Okta](#org2b57826)
- [Running the sample](#orgfde9a67)
  - [Create `sample.html`](#orgcf7a7d6)
  - [Run the sample](#orgcd70a8e)
  - [About the sample](#org07c4108)
  - [Additional resources](#org2d7a83f)
- [Code](#org0134d7a)
  - [sample.html](#org24b33fb)
  - [JavaScript for sample.html](#orge9113e6)



<a id="org93fbff3"></a>

# Okta and AWS in the Browser

This guide is designed to walk readers through the following:

-   Integrating an AWS-backed JavaScript web application with Okta.
-   Setting up properly scoped permissions for federated access to AWS APIs.
-   Basic usage of the AWS SDK for JavaScript.

The sample application below authenticates users using [web identity federation](http://docs.aws.amazon.com/STS/latest/UsingSTS/web-identity-federation.html) and Okta. This guide is based on the AWS [JavaScript in the Browser](https://aws.amazon.com/developers/getting-started/browser/) guide.

After logging in, the user will get temporary AWS credentials and assume the pre-specified [IAM (AWS Identity and Access Management)](http://docs.aws.amazon.com/IAM/latest/UserGuide/roles-toplevel.html) role whose policy allows uploading and listing objects in [Amazon S3](http://aws.amazon.com/s3/).

> ****Note****! These instructions require that your Okta Org is part of the **OpenID Connect Beta**. If you do not have the ability to create OpenID Connect apps in your Okta org, please contact Okta Support and ask that the `OPENID_CONNECT` flag be enabled for your Okta org.


<a id="orga9564ed"></a>

# Setting up Okta


<a id="orga3b725e"></a>

## Create an Okta OIDC App and get the Client ID for that app

You will need an OpenID Connect app in Okta for this sample application. You can create an OpenID Connect app as follows:

1.  Log in to your Okta org
2.  After logging in, click on the "Admin" button on the upper right of the screen.
3.  Select "Add Applications" from the "Shortcuts" section on the right side of the screen.
4.  Click the "Create New App" button on the left side of the screen.
5.  Set the "Platform" to: "Single Page App (SPA)", click the "Create" button.
6.  Name the application (e.g. `AWS Example`), click the "Next" button.
7.  Click "Add URI" and add the `http://localhost:8000/sample.html` URI, then click the "Finish" button.
8.  Click on the "People" section, click "Assign to People", click the "Assign" button next to your username, click "Save and Go Back", click "Done".

    > **Important:** Only users assigned to this app will be able to authenticate!
9.  Click on the "General" section, scroll down and make note of the "**Client ID**", you will use this when you configure AWS.


<a id="orgd181b60"></a>

## Set up CORS in Okta

This sample application also requires that you [enable CORS](http://developer.okta.com/docs/api/getting_started/enabling_cors.html) in Okta.

1.  From the "Security" menu in the Admin interface, select the "API" option.
2.  Click on the "CORS" tab in the API screen.
3.  Click the "Edit" button, make sure the "Enable CORS &#x2026;" option is selected, enter `http://localhost:8000` into the text field, then click the "Save" button.


<a id="orgdb54a25"></a>

# Setting up AWS


<a id="org7dd9bf7"></a>

## Create an Amazon S3 bucket and configure CORS

[CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing) needs to be configured on the Amazon S3 bucket to be accessed directly from JavaScript in the browser.

1.  Navigate to the [Amazon S3 console](https://console.aws.amazon.com/s3/home).
2.  Choose an existing bucket or create a new bucket if desired. Note the bucket name and bucket region for later use in the application.
3.  Click the **Properties** tab, open the **Permissions** section, and click **Edit CORS Configuration**.
4.  Copy the below XML into the text box and click **Save**.

    ```xml
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
    ```


<a id="orgfdaed95"></a>

## Create an IAM OpenID Connect Provider

1.  Go to the **Identity Providers** section of the [IAM console](https://console.aws.amazon.com/iam/home#policies) and click the "Create Provider" button, select "OpenID Connect", enter your Okta org URL as the **Provider URL** (e.g. `https://example.okta.com`), enter your Okta app *Client ID* as the **Audience**, click "Next Step"
2.  Click "Create" to skip the "Verify Provider Information" instructions. *This step is for OIDC providers that sign their OIDC tokens* *using the private key from their HTTPS/TLS certificate. Okta* *signs OIDC tokens using different keys*


<a id="org2b57826"></a>

## Create an IAM Role and Assign Users Logged in through Okta

1.  Go to the **Policies** section of the [IAM console](https://console.aws.amazon.com/iam/home#policies) and click **Create Policy → Create Your Own Policy**.
2.  Name your policy (e.g. `OktaSample`), copy the JSON policy below to the **Policy Document** text box, and replace the two instances of `YOUR_BUCKET_NAME` with your actual bucket name, and click **Create Policy**.
3.  Now go to the **Roles** section of the IAM console and click **Create New Role**
4.  Name your role (e.g. `OktaSampleRole`) and select **Role for Identity Provider Access → Grant access to web identity providers.**
5.  Select your Okta org from the **Identity Provider** dropdown and click "Next Step"
6.  Click "Next Step" on Verify Role Trust.
7.  On the **Attach Policy** step, select the policy you just created (e.g. `OktaSample`), and click **Next Step**, then **Create Role** on the next page.
8.  Use the JSON below as your for your role.

    > **Important:** Make sure that you replace `YOUR_BUCKET_NAME` and `YOUR_OIDC_PROVIDER_URL` in the policy!

    ```javascript
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
    ```

    > **Important:** Make sure you include `:sub` after the end of your OIDC provider URL. For example `example.okta.com:sub` or `example.oktapreview.com:sub`

    If you are wondering, this policy uses [IAM Policy Variables](http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html) to restrict `ListBucket` calls to only the files that a user has uploaded.


<a id="orgfde9a67"></a>

# Running the sample


<a id="orgcf7a7d6"></a>

## Create `sample.html`

Before you can run the example, you need to create a file named "`sample.html`" containing the code below. If you name this file something other than `sample.html`, you'll have to go back and update the settings for your OIDC app.

Replace the variables in `sample.html` with the approprate variables for your system. The variables that you will need to replace are below:

-   `YOUR_OIDC_PROVIDER_URL` i.e. *example.okta.com*
-   `YOUR_AWS_ROLE_ARN` i.e. *arn:aws:iam::123456789012:role/OktaSampleRole*
-   `YOUR_AWS_REGION` i.e. *us-east-1*
-   `YOUR_S3_BUCKET_NAME` i.e. *example-s3-bucket*
-   `YOUR_OKTA_ORG_URL` i.e. *<https://example.okta.com>*
-   `YOUR_OKTA_APP_CLIENT_ID` i.e. *aBCdEf0GhiJkLMno1pq2*

> The ARN (Amazon Resource Name) of your IAM role can be found in the [IAM console](https://console.aws.amazon.com/iam/home?#roles) by selecting your role and opening the **Summary** tab.

The code for `sample.html` is code below.

Make sure to replace the variables mentioned above!

```html
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
      var uploadButton = document.getElementById('upload-button');
      var results = document.getElementById('results');
      var oktaLoginContainer = document.getElementById('okta-login-container');
      var uploadDialog = document.getElementById('upload-dialog');

      uploadButton.addEventListener('click', function () {
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
```


<a id="orgcd70a8e"></a>

## Run the sample

Start a webserver on your server on port 8000 and visit <http://localhost:8000/sample.html>

If you are on Mac OS X or Linux, you can use Python to start a webserver for you: `cd` to the directory where `sample.html` is located, then run this command:

    [okta-oidc-aws]$ python -m SimpleHTTPServer 8000


<a id="org07c4108"></a>

## About the sample

This sample application is designed to show you how to:

-   Use AWS Web Identity Federation and Okta to authenticate users.
-   Assign user-specific write permissions at the prefix level with IAM role policy so that users can't overwrite or change other users' objects.
-   Instantiate an [Amazon Simple Storage Service (Amazon S3)](https://aws.amazon.com/s3/) client.
-   Use `<input type="file" />` tag that calls the browser's native file interface, and upload the chosen file to an Amazon S3 bucket, with 'public-read' permissions.


<a id="org2d7a83f"></a>

## Additional resources

For in-depth user guides, API documentation, developer forums, and other developer resources, see the [AWS SDK for JavaScript in the Browser](https://aws.amazon.com/sdk-for-browser/) page.

For more details on the Okta Sign-In Widget, see the [Okta Sign-In Widget Overview](http://developer.okta.com/code/javascript/okta_sign-in_widget.html) or the [Okta Sign-In Widget reference](http://developer.okta.com/code/javascript/okta_sign-in_widget_ref).


<a id="org0134d7a"></a>

# Code

This section describes the code used in this sample application. You only need to read this if you want to learn more about how the sample application works.

This sample consists of two logical components:

1.  The HTML for a sample Single Page Application
2.  The JavaScript that powers this sample Single Page Application


<a id="org24b33fb"></a>

## sample.html

The HTML for this sample is below. By default we show the Okta Sign-In Widget and hide the `upload-dialog` `<div>` with the buttons for uploading files to S3.

After a successful login, we will hide the Okta Sign-In Widget and show the `upload-dialog` `<div>`.

The JavaScript that powers this sample is covered in the next section.

```html
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
```


<a id="orge9113e6"></a>

## JavaScript for sample.html

Here is the JavaScript used in sample.html, it is followed by a detailed description of how it works:

```javascript
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
var uploadButton = document.getElementById('upload-button');
var results = document.getElementById('results');
var oktaLoginContainer = document.getElementById('okta-login-container');
var uploadDialog = document.getElementById('upload-dialog');

uploadButton.addEventListener('click', function () {
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
```

The most important part of this sample is the configuration variables for AWS and Okta.

For AWS, we need the following:

1.  The **domain name** for an **OIDC provider**.

    This is the domain name for the Okta org that you are connecting to AWS. It will look something like "example.okta.com" or "example.oktapreview.com"

2.  An **AWS Role ARN**.

    The [Amazon Resource Name](http://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html) for the IAM Role that Okta users will be placed into.

3.  The **AWS Region** you've configured your IAM OpenID Connect Provider in.

4.  The **S3 Bucket** that yor AWS Role grants permissions to.

The JavaScript in `sample.html` is described below.

These variables are needed to configure the AWS JS SDK:

```javascript
// e.g.: example.okta.com
var AWS_OIDC_PROVIDER_URL = 'YOUR_OIDC_PROVIDER_URL';
// e.g.: arn:aws:iam::123456789012:role/OktaSampleRole
var AWS_ROLE_ARN = 'YOUR_AWS_ROLE_ARN';
// e.g.: us-east-1
var AWS_REGION = 'YOUR_AWS_REGION';
// e.g.: example-s3-bucket
var AWS_S3_BUCKET_NAME = 'YOUR_S3_BUCKET_NAME';
```

For Okta, we need the following:

1.  The Okta org URL
2.  The Client ID for the Okta app that users will be assigned to.

The variables below are needed to configure the Okta Sign-In widget:

```javascript
// e.g.: https://example.okta.com
var OKTA_ORG_URL = 'YOUR_OKTA_ORG_URL';
// e.g.: aBCdEf0GhiJkLMno1pq2
var OKTA_CLIENT_ID = 'YOUR_OKTA_APP_CLIENT_ID';
```

This code initializes the AWS JavaScript SDK. We also configure the SDK to send logging information to the JavaScript console.

```javascript
AWS.config.region = AWS_REGION;
AWS.config.logger = console;
```

The variables below are global variables that are used to communicate between the various event handlers and callbacks in this example.

`oktaUserId` is set after a user sucessfully authenticates with the Okta Sign-In Widget.

`bucket` is used to pass S3 bucket information between the authentication code, the function that lists the contents of the bucket, and the function which handles click events on the "Upload to S3" button.

```javascript
var oktaUserId;
var bucket;
```

The variables below are selectors for the various HTML elements that are used in this sample.

```javascript
var fileChooser = document.getElementById('file-chooser');
var uploadButton = document.getElementById('upload-button');
var results = document.getElementById('results');
var oktaLoginContainer = document.getElementById('okta-login-container');
var uploadDialog = document.getElementById('upload-dialog');
```

This code sets up a event listener for the "Upload to S3" button. The "Upload to S3" button is hidden until a user has succesfully authentiated against Okta and AWS. Note the use of the `bucket` *global variable*, which is only populated after a user sucessfully authenticates.

```javascript
uploadButton.addEventListener('click', function () {
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
```

This function is called after a successful user authentication. It lists all of the S3 objects that a user has permision to see. Note that our S3 policy only allows users to see files that the uploaded. These users are scoped to an S3 `Prefix` which contains their user id.

```javascript
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
```

This code sets up `oktaSignIn` to be an instance of the `OktaSignIn` widget. The `authParams` are telling the Okta Sign-In Widget that we want an OIDC `id_token`, that will use the `okta_post_message` response mode to communicate with Okta. The `openid` scope is needed to get an OIDC response. The `groups` scope tells Okta to include a user's groups in the OIDC `id_token`.

```javascript
var oktaSignIn = new OktaSignIn({
  authParams: {
    responseType: 'id_token',
    responseMode: 'okta_post_message',
    scopes: ['openid', 'groups']
  },
  clientId: OKTA_CLIENT_ID,
  baseUrl: OKTA_ORG_URL
});
```

Finally, we initialize the Okta Sign-In Widget. For the purposes of this example, we only hand the "SUCCESS" state. You would want to handle the other states in production code.

See below for details on the code that is run on the "SUCCESS" state.

```javascript
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
```

Upon a successful login, we do the following:

-   Log the value of the Okta user resource "`res`" to the JavaScript `console`
-   Configure the `oktaUserId` global with the proper Okta User ID or "subject".
-   Use the OIDC id\_token (`res.idToken`) to configure a Web Identity Credentials object.

```javascript
console.log('User successfully authenticated');
console.log(res);
oktaUserId = res.claims.sub;
AWS.config.credentials = new AWS.WebIdentityCredentials({
  RoleArn: AWS_ROLE_ARN,
  WebIdentityToken: res.idToken
});
```

Once we have configured the `AWS.config.credentials` object, we call the `.get()` method to use authenticate against AWS using the OIDC id\_token we got from Okta.

After checking for an error (`err`), we do the following:

-   Define an AWS S3 `bucket` object in the context of a logged in user, for other parts of the example to use.
-   Hide the Okta Sign-In Widget (`oktaLoginContainer`)
-   Show the buttons for selecting a file and uploading it to S3 (`uploadDialog`)
-   List any objects that the user might have uploaded previously.

&nbsp;

```javascript
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
```
