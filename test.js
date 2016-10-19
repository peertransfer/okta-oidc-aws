// From the node.js standard library:
var fs = require('fs');
var https = require('https');
// npm install aws-sdk
var AWS = require('aws-sdk');

// var certs = [
//     fs.readFileSync('./charles-ssl-proxying-certificate.pem')
// ];
// var HttpProxyAgent = require('https-proxy-agent');
// AWS.config.httpOptions = HttpProxyAgent('http://localhost:8888');

var MY_OIDC_PROVIDER_URL = 'jfranusic.oktapreview.com';
var MY_JWT_RETURNED_FROM_OIDC_PROVIDER = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFXbEJNc2dNRnFBS2VwbnVjVUpvZ0JHSWFoMkFxS1dwU25iNngzVjVpSW8ifQ.eyJzdWIiOiIwMHUya2pqYmloTURHQkxRU1VNWCIsIm5hbWUiOiJKb8OrbCBGcmFudXNpYyIsImVtYWlsIjoiam9lbC5mcmFudXNpY0Bva3RhLmNvbSIsInZlciI6MSwiaXNzIjoiaHR0cHM6Ly9qZnJhbnVzaWMub2t0YXByZXZpZXcuY29tIiwiYXVkIjoidU9LbVFyN053eUptQ01vaThqcjAiLCJpYXQiOjE0NjQzODQyMzksImV4cCI6MTQ2NDM4NzgzOSwianRpIjoiUmdtaHlxU2JoTkM0UEpieHcxMlIiLCJhbXIiOlsicHdkIl0sImlkcCI6IjAwbzJrampiaTZWS01HUlVETEpaIiwibm9uY2UiOiJzdGF0aWNOb25jZSIsInByZWZlcnJlZF91c2VybmFtZSI6ImpvZWwuZnJhbnVzaWNAb2t0YS5jb20iLCJnaXZlbl9uYW1lIjoiSm_Dq2wiLCJmYW1pbHlfbmFtZSI6IkZyYW51c2ljIiwiem9uZWluZm8iOiJBbWVyaWNhL0xvc19BbmdlbGVzIiwidXBkYXRlZF9hdCI6MTQ2MTk3NTI4MCwiZW1haWxfdmVyaWZpZWQiOnRydWUsImF1dGhfdGltZSI6MTQ2NDM4NDE4MCwic2hlbGwiOiIvZGV2L3Rjc2giLCJncm91cHMiOlsiYnJhbmQ6Qmx1ZSIsImJyYW5kOkdyZWVuIiwiYnJhbmQ6TmVvbiJdfQ.EPgzDelWlx28T-OqJfw97nF4w3ZrfnQtkNJSaRlR08X2gQuIH7d6l8MPQrGVqgFuXQ-HRgk9w7psDz15bXiN5pSOPZ6-QzlhCq1XDGcBSD6OyEL6h5NgTtKaQ7z-e63y0Rd52MYSyqs9z0CdMp7EMmT7OPwTwDDJEyJVhPEwNaO1CLDULYmeGWXc4UdLXjpF-wAuDuyv2Mm6FvneCvD4I2N-Uz1uzjyDg_CNz8ZcH5pnd_7FdVzfCRune4WUS9yA8fwn5pI5IR8CQOTbtwtiJGusXjt3cLNDFViqhddn103hdWH75v_viEeyrFhpcgmNWXX1r8l-Yddxo5gA6MHdqQ';
var MY_ACCOUNT_ID = '832503333592';
// This tells Cognito which Cognito identity pool to use
var MY_ID_POOL_ID = 'us-east-1:4c2fb031-039f-45e2-8cf4-df80dc5bf377';

AWS.config.region = 'us-east-1';
var cognitoidentity = new AWS.CognitoIdentity();
var provider_url = MY_OIDC_PROVIDER_URL
var logins = {};
logins[provider_url] = MY_JWT_RETURNED_FROM_OIDC_PROVIDER;
var idparams = {
    AccountId: MY_ACCOUNT_ID,
    IdentityPoolId: MY_ID_POOL_ID,
    Logins: logins
};
cognitoidentity.getId(idparams, function(err, data) {
    if (err) console.log(err, err.stack);
    else     console.log(data);
});
