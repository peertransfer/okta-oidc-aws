AWS.config.region = AWS_REGION;
// AWS.config.logger = console;

var oktaUserId;
var bucket;

var fileChooser = document.getElementById('file-chooser');
var results = document.getElementById('results');
var oktaLoginContainer = document.getElementById('okta-login-container');
var s3Explorer = document.getElementById('page-wrapper');

var s3exp_config = {
  Region: '',
  Bucket: AWS_S3_BUCKET_NAME,
  Prefix: '',
  Delimiter: '/'
};
var s3exp_lister = null;
var s3exp_columns = {
  key: 1,
  folder: 2,
  date: 3,
  size: 4
};

AWS.config.region = 'us-east-1';

// Initialize S3 SDK and the moment library (for time formatting utilities)
var s3 = new AWS.S3();
moment().format();

function bytesToSize(bytes) {
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  var ii = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, ii), 2) + ' ' + sizes[ii];
}

// Custom startsWith function for String prototype
if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function(str) {
    return this.indexOf(str) == 0;
  };
}

// Custom endsWith function for String prototype
if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function(str) {
    return this.slice(-str.length) == str;
  };
}

function object2hrefvirt(bucket, key) {
  var enckey = key.split('/').map(function(x) { return encodeURIComponent(x); }).join('/');

  if (AWS.config.region === "us-east-1") {
    return document.location.protocol + '//' + bucket + '.s3.amazonaws.com/' + enckey;
  } else {
    return document.location.protocol + '//' + bucket + '.s3-' + AWS.config.region + '.amazonaws.com/' + enckey;
  }
}

function object2hrefpath(bucket, key) {
  var enckey = key.split('/').map(function(x) { return encodeURIComponent(x); }).join('/');

  if (AWS.config.region === "us-east-1") {
    return document.location.protocol + "//s3.amazonaws.com/" + bucket + "/" + enckey;
  } else {
    return document.location.protocol + "//s3-' + AWS.config.region + '.amazonaws.com/" + bucket + "/" + enckey;
  }
}

function isthisdocument(bucket, key) {
  return key === "index.html";
}

function isfolder(path) {
  return path.endsWith('/');
}

// Convert cars/vw/golf.png to golf.png
function fullpath2filename(path) {
  return path.replace(/^.*[\\\/]/, '');
}

// Convert cars/vw/golf.png to cars/vw
function fullpath2pathname(path) {
  return path.substring(0, path.lastIndexOf('/'));
}

// Convert cars/vw/ to vw/
function prefix2folder(prefix) {
  var parts = prefix.split('/');
  return parts[parts.length - 2] + '/';
}

// Remove hash from document URL
function removeHash() {
  history.pushState("", document.title, window.location.pathname + window.location.search);
}

// We are going to generate bucket/folder breadcrumbs. The resulting HTML will
// look something like this:
//
// <li>Home</li>
// <li>Library</li>
// <li class="active">Samples</li>
//
// Note: this code is a little complex right now so it would be good to find
// a simpler way to create the breadcrumbs.
function folder2breadcrumbs(data) {
  if (data.params.Prefix && data.params.Prefix.length > 0) {
    window.location.hash = data.params.Prefix;
  } else {
    removeHash();
  }

  // The parts array will contain the bucket name followed by all the
  // segments of the prefix, exploded out as separate strings.
  var parts = [data.params.Bucket];

  if (data.params.Prefix) {
    parts.push.apply(parts,
      data.params.Prefix.endsWith('/') ?
      data.params.Prefix.slice(0, -1).split('/') :
      data.params.Prefix.split('/'));
  }

  // Empty the current breadcrumb list
  $('#breadcrumb li').remove();

  // Now build the new breadcrumb list
  var buildprefix = '';
  $.each(parts, function(ii, part) {
    var ipart;

    // Add the bucket (the bucket is always first)
    if (ii === 0) {
      var a1 = $('<a>').attr('href', '#').text(part);
      ipart = $('<li>').append(a1);
      a1.click(function(e) {
        e.preventDefault();
        s3exp_config = {
          Bucket: data.params.Bucket,
          Prefix: '',
          Delimiter: data.params.Delimiter
        };
        (s3exp_lister = s3list(s3exp_config, s3draw)).go();
      });
      // Else add the folders within the bucket
    } else {
      buildprefix += part + '/';

      if (ii == parts.length - 1) {
        ipart = $('<li>').addClass('active').text(part);
      } else {
        var a2 = $('<a>').attr('href', '#').append(part);
        ipart = $('<li>').append(a2);

        // Closure needed to enclose the saved S3 prefix
        (function() {
          var saveprefix = buildprefix;
          a2.click(function(e) {
            e.preventDefault();
            s3exp_config = {
              Bucket: data.params.Bucket,
              Prefix: saveprefix,
              Delimiter: data.params.Delimiter
            };
            (s3exp_lister = s3list(s3exp_config, s3draw)).go();
          });
        })();
      }
    }
    $('#breadcrumb').append(ipart);
  });
}

function s3draw(data, complete) {
  $('li.li-bucket').remove();
  folder2breadcrumbs(data);

  // Add each part of current path (S3 bucket plus folder hierarchy) into the breadcrumbs
  $.each(data.CommonPrefixes, function(i, prefix) {
    $('#tb-s3objects').DataTable().rows.add([{
      Key: prefix.Prefix
    }]);
  });

  // Add S3 objects to DataTable
  $('#tb-s3objects').DataTable().rows.add(data.Contents).draw();
}

function s3list(config, completecb) {
  var params = {
    Bucket: config.Bucket,
    Prefix: config.Prefix,
    Delimiter: config.Delimiter
  };
  var scope = {
    Contents: [],
    CommonPrefixes: [],
    params: params,
    stop: false,
    completecb: completecb
  };

  return {
    // This is the callback that the S3 API makes when an S3 listObjectsV2
    // request completes (successfully or in error). Note that a single call
    // to listObjectsV2 may not be enough to get all objects so we need to
    // check if the returned data is truncated and, if so, make additional
    // requests with a 'next marker' until we have all the objects.
    cb: function(err, data) {
      if (err) {
        scope.stop = true;
        $('#bucket-loader').removeClass('fa-spin');
        bootbox.alert("Error accessing S3 bucket " + scope.params.Bucket + ". Error: " + err);
      } else {
        // Store marker before filtering data
        if (data.IsTruncated) {
          if (data.NextContinuationToken) {
            scope.params.ContinuationToken = data.NextContinuationToken;
          }
        }

        // Filter the folders out of the listed S3 objects
        // (could probably be done more efficiently)
        data.Contents = data.Contents.filter(function(el) {
          return el.Key !== scope.params.Prefix;
        });

        // Accumulate the S3 objects and common prefixes
        scope.Contents.push.apply(scope.Contents, data.Contents);
        scope.CommonPrefixes.push.apply(scope.CommonPrefixes, data.CommonPrefixes);

        // Update badge count to show number of objects read
        $('#badgecount').text(scope.Contents.length + scope.CommonPrefixes.length);

        if (scope.stop) {
          return;
        } else if (data.IsTruncated) {
          s3.listObjects(scope.params, scope.cb);
        } else {
          delete scope.params.ContinuationToken;
          if (scope.completecb) {
            scope.completecb(scope, true);
          }
          $('#bucket-loader').removeClass('fa-spin');
        }
      }
    },

    // Start the spinner, clear the table, make an S3 listObjectsV2 request
    go: function() {
      scope.cb = this.cb;
      $('#bucket-loader').addClass('fa-spin');
      $('#tb-s3objects').DataTable().clear();
      s3.listObjects(scope.params, this.cb);
    },

    stop: function() {
      scope.stop = true;
      delete scope.params.ContinuationToken;
      if (scope.completecb) {
        scope.completecb(scope, false);
      }
      $('#bucket-loader').removeClass('fa-spin');
    }
  };
}

function promptForBucketInput() {
  bootbox.prompt("Please enter the S3 bucket name", function(result) {
    if (result !== null) {
      resetDepth();
      s3exp_config = {
        Bucket: result,
        Delimiter: '/'
      };
      (s3exp_lister = s3list(s3exp_config, s3draw)).go();
    }
  });
}

function resetDepth() {
  $('#tb-s3objects').DataTable().column(1).visible(false);
  $('input[name="optionsdepth"]').val(['folder']);
  $('input[name="optionsdepth"][value="bucket"]').parent().removeClass('active');
  $('input[name="optionsdepth"][value="folder"]').parent().addClass('active');
}

function showExplorer() {
  // Click handler for refresh button (to invoke manual refresh)
  $('#bucket-loader').click(function(e) {
    if ($('#bucket-loader').hasClass('fa-spin')) {
      // To do: We need to stop the S3 list that's going on
      // bootbox.alert("Stop is not yet supported.");
      s3exp_lister.stop();
    } else {
      delete s3exp_config.ContinuationToken;
      (s3exp_lister = s3list(s3exp_config, s3draw)).go();
    }
  });

  // Click handler for bucket button (to allow user to change bucket)
  $('#bucket-chooser').click(function(e) {
    promptForBucketInput();
  });

  $('#hidefolders').click(function(e) {
    $('#tb-s3objects').DataTable().draw();
  });

  // Folder/Bucket radio button handler
  $("input:radio[name='optionsdepth']").change(function() {
    // If user selected deep then we do need to do a full list
    if ($(this).val() == 'bucket') {
      var choice = $(this).val();
      $('#tb-s3objects').DataTable().column(1).visible(choice === 'bucket');
      delete s3exp_config.ContinuationToken;
      delete s3exp_config.Prefix;
      s3exp_config.Delimiter = '';
      (s3exp_lister = s3list(s3exp_config, s3draw)).go();
      // Else user selected folder then can do a delimiter list
    } else {
      $('#tb-s3objects').DataTable().column(1).visible(false);
      delete s3exp_config.ContinuationToken;
      delete s3exp_config.Prefix;
      s3exp_config.Delimiter = '/';
      (s3exp_lister = s3list(s3exp_config, s3draw)).go();
    }
  });

  function renderObject(data, type, full) {
    if (isthisdocument(s3exp_config.Bucket, data)) {
      return fullpath2filename(data);
    } else if (isfolder(data)) {
      return '<a data-s3="folder" data-prefix="' + data + '" href="' + object2hrefvirt(s3exp_config.Bucket, data) + '">' + prefix2folder(data) + '</a>';
    } else {
      return '<a data-s3="object" href="' + object2hrefvirt(s3exp_config.Bucket, data) + '"download="' + fullpath2filename(data) + '">' + fullpath2filename(data) + '</a>';
    }
  }

  function renderFolder(data, type, full) {
    return isfolder(data) ? "" : fullpath2pathname(data);
  }

  // Initial DataTable settings
  $('#tb-s3objects').DataTable({
    iDisplayLength: 50,
    order: [
      [1, 'asc'],
      [0, 'asc']
    ],
    aoColumnDefs: [{
      "aTargets": [0],
      "mData": "Key",
      "mRender": function(data, type, full) {
        return (type == 'display') ? renderObject(data, type, full) : data;
      },
      "sType": "key"
    }, {
      "aTargets": [1],
      "mData": "Key",
      "mRender": function(data, type, full) {
        return renderFolder(data, type, full);
      }
    }, {
      "aTargets": [2],
      "mData": "LastModified",
      "mRender": function(data, type, full) {
        return data ? moment(data).fromNow() : "";
      }
    }, {
      "aTargets": [3],
      "mData": "LastModified",
      "mRender": function(data, type, full) {
        return data ? moment(data).local().format('YYYY-MM-DD HH:mm:ss') : "";
      }
    }, {
      "aTargets": [4],
      "mData": function(source, type, val) {
        return source.Size ? ((type == 'display') ? bytesToSize(source.Size) : source.Size) : "";
      }
    }, ]
  });

  $('#tb-s3objects').DataTable().column(s3exp_columns.key).visible(false);

  // Custom sort for the Key column so that folders appear before objects
  $.fn.dataTableExt.oSort['key-asc'] = function(a, b) {
    var x = (isfolder(a) ? "0-" + a : "1-" + a).toLowerCase();
    var y = (isfolder(b) ? "0-" + b : "1-" + b).toLowerCase();
    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
  };

  $.fn.dataTableExt.oSort['key-desc'] = function(a, b) {
    var x = (isfolder(a) ? "1-" + a : "0-" + a).toLowerCase();
    var y = (isfolder(b) ? "1-" + b : "0-" + b).toLowerCase();
    return ((x < y) ? 1 : ((x > y) ? -1 : 0));
  };

  // Allow user to hide folders
  $.fn.dataTableExt.afnFiltering.push(function(oSettings, aData, iDataIndex) {
    return $('#hidefolders').is(':checked') ? !isfolder(aData[0]) : true;
  });

  // Delegated event handler for S3 object/folder clicks. This is delegated
  // because the object/folder rows are added dynamically and we do not want
  // to have to assign click handlers to each and every row.
  $('#tb-s3objects').on('click', 'a', function(event) {
    event.preventDefault();
    var target = event.target;

    if (target.dataset.s3 === "folder") {
      // If the user has clicked on a folder then navigate into that folder
      resetDepth();
      delete s3exp_config.ContinuationToken;
      s3exp_config.Prefix = target.dataset.prefix;
      s3exp_config.Delimiter = $("input[name='optionsdepth']:checked").val() == "folder" ? "/" : "";
      (s3exp_lister = s3list(s3exp_config, s3draw)).go();
    } else {
      // Else user has clicked on an object so download it in new window/tab

      const signedUrlExpireSeconds = 60 * 5 // your expiry time in seconds.
      const url = s3.getSignedUrl('getObject', {
        Bucket: s3exp_config.Bucket,
        Key: s3exp_config.Prefix + target.download,
        Expires: signedUrlExpireSeconds
      });

      window.open(url, 'Download');
    }
    return false;
  });

  // Document URL typically looks like this for path-style URLs:
  // - https://s3.amazonaws.com/mybucket1/index.html
  // - https://s3-us-west-2.amazonaws.com/mybucket2/index.html
  //
  // Document URL typically looks like this for virtual-hosted-style URLs:
  // - https://mybucket1.s3.amazonaws.com/index.html
  // - https://mybucket2.s3-us-west-2.amazonaws.com/index.html
  //
  // Document URL typically looks like this for S3 website hosting:
  // - http://mybucket3.s3-website-us-east-1.amazonaws.com/
  // - http://mybucket4.s3-website.eu-central-1.amazonaws.com/

  // TODO: need to support S3 website hosting option
  //
  // If we're launched from a bucket then let's try to determine the bucket
  // name so we can query it immediately, without requiring the user to
  // supply the bucket name.
  //
  // If the region was anything other than US Standard then we will also need
  // to infer the region so that we can initialize the S3 SDK properly.
  var urls = document.URL.split('/');

  // Using technique from https://gist.github.com/jlong/2428561
  // to parse the document URL.
  var parser = document.createElement('a');
  parser.href = document.URL;

  // If initial bucket has been hard-coded above then use it, else try to
  // derive the initial bucket from the document URL (useful if index.html was
  // launched directly from within a bucket), else prompt the user.
  if (s3exp_config.Bucket) {
    (s3exp_lister = s3list(s3exp_config, s3draw)).go();
  } else {
    promptForBucketInput();
  }
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
      oktaUserId = res.claims.sub;
      AWS.config.credentials = new AWS.WebIdentityCredentials({
        RoleArn: AWS_ROLE_ARN,
        WebIdentityToken: res.idToken
      });
      AWS.config.credentials.get(function(err) {
        if (err) {
          return;
        }
        s3 = new AWS.S3({
          params: {
          }, signatureVersion: "v4"
        });
        oktaLoginContainer.style.display = 'none';
        s3Explorer.style.display = 'block';
        showExplorer();
      });
    } else {
      console.log('Login status is not "SUCCESS"');
      console.log(res);
    }
  }
);
