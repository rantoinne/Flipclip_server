var moment = require('moment');
var request = require('request');
var uuid = require('node-uuid');
var config = require('../config/config');

var accessToken;
var base_url = "https://flipclipms.restv2.centralindia.media.azure.net/api/";
var headers;
var pendingRequests = {};
var mediaProcessorId;

var getAccessToken = function (callback) {
    console.log( arguments.callee.name );
    console.log("helllla")
    // callback = callback || function () {};
    // request.post({
    //     uri: config.oauthurl,
    //     form: {
    //         client_id: config.client_id,
    //         client_secret: config.client_secret,
    //         grant_type:'client_credentials',
    //         resource:'https://rest.media.azure.net'
    //     },
    //     strictSSL: true
    // }, function (err, res) {
    //     if (err) {
    //         return callback(err);
    //     }
    //     var result = JSON.parse(res.body);
    //     // console.log(result);
    //     if (result.error) {
    //         return callback(result);
    //     }
    //     console.log("generated token is ", result.access_token);
    //     accessToken = 'Bearer ' + result.access_token;
    //     headers = {
    //         'Content-Type': 'application/json;odata=verbose',
    //         'Accept': 'application/json;odata=verbose',
    //         'DataServiceVersion': '3.0',
    //         'MaxDataServiceVersion': '3.0',
    //         'x-ms-version': '2.17',
    //         'Authorization': accessToken
    //     }
    //     callback(err);
    // });
    return 'ok'
}

// var getRedirectURL = function (callback) {
//   console.log( arguments.callee.name );
//     callback = callback || function () {};
//     request.get({
//         uri: "https://flipclipms.restv2.centralindia.media.azure.net/api/",
//         headers: {'Accept': 'application/json', 'Authorization': accessToken, 'x-ms-version': '2.11'},
//         followRedirect: false,
//         strictSSL: true
//     }, function (err, res) {
//
//         if (err) {
//           callback(err || ': Expected 301 status, received: ' + res.statusCode + '\n' + res.body);
//         } else {
//           console.log(res.headers.location);
//           if (res.statusCode == 301) {
//               base_url = res.headers.location;
//               callback(err);
//           } else {
//               callback(err || ': Expected 301 status, received: ' + res.statusCode + '\n' + res.body);
//           }
//         }
//
//     });
// }

var getMediaProcessors = function(callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    console.log(headers);
    request.get({
        uri: base_url + "MediaProcessors()?$filter=Name%20eq%20'Media%20Encoder%20Standard'",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
      if (!err) {
        if (res.statusCode == 200) {
            console.log("the response body of media processores call is ",res.body);
            mediaProcessorId = JSON.parse(res.body).d.results[0].Id;
            console.log("The media processore id is ", mediaProcessorId);
            callback(err);
        } else {
          console.log("The error is ", err);
            console.log("The respose status code is ",res.statusCode);
        }
      } else {
        console.log("the error is ",err);
      }
    });
}

var createAsset = function(data, callback) {
  console.log( arguments.callee.name );
  console.log("with data ",data);
    callback = callback || function () {};
    // console.log("the base url for create Asset is ",base_url);
    request.post({
        uri: base_url + 'Assets',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {

      if (err) {
        console.log("the error is ", err);
        callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
      } else {
        if (res.statusCode == 201) {
            var assetId = JSON.parse(res.body).d.Id;
            pendingRequests[assetId] = {'assetId': assetId};
            console.log("The created assetId is ", assetId);
            callback(err, assetId);
        } else {
            console.log(': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
        }
      });
}

var deleteAsset = function(assetId, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    request({
        method: 'DELETE',
        uri: base_url + "Assets('" + encodeURIComponent(assetId) + "')",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) {
            callback(err);
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var createAssetFile = function(data, assetId, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    request.post({
        uri: base_url + 'Files',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var assetFileId = JSON.parse(res.body).d.Id;
            console.log("generated asset file id is ", assetFileId);
            pendingRequests[assetId] = {'assetFileId': assetFileId};
            callback(err, assetId);
        } else {
          console.log("createassetfile failed with : ",err);
          console.log("status code is ", res.statusCode);
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var updateAssetFile = function(assetFileId, data, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    var url = base_url + "Files('" + encodeURIComponent(assetFileId) + "')";
    request({
        method: 'MERGE',
        uri: url,
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) { // 204 means no content
            callback(err);
        } else {
            callback(err || ': Expected 204 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var createPolicy = function(data, assetId, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    request.post({
        uri: base_url + 'AccessPolicies',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var policyId = JSON.parse(res.body).d.Id;
            console.log("created policay with id ", policyId);
            callback(err, assetId, policyId);
        } else {
            console.log(': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var deletePolicy = function(policyId, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    var url = base_url + "AccessPolicies('" + encodeURIComponent(policyId) + "')"
    request({
        method: 'DELETE',
        uri: url,
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) {
            callback(err);
        } else {
            callback(err || 'Expected 204 status, received: ' + res.statusCode);
        }
    });
}

var createLocator = function(assetId, policyId, type, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    var data = {
        "AccessPolicyId": policyId,
        "AssetId" : assetId,
        "StartTime" : moment.utc().subtract(10, 'minutes').format('M/D/YYYY hh:mm:ss A'),
        "Type":type,
    }
    request.post({
        uri: base_url + 'Locators',
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var resURL = JSON.parse(res.body).d.Path;
            var locatorId = JSON.parse(res.body).d.Id;
            console.log("Locator cretaed with resurl and locatorId as ", resURL, locatorId);
            pendingRequests[assetId]['policyId'] = policyId;
            pendingRequests[assetId]['locatorId'] = locatorId;
            callback(err, assetId, policyId, locatorId, resURL);
        } else {
          console.log(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var deleteLocator = function(locatorId, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    var url = base_url + "Locators('" + encodeURIComponent(locatorId) + "')";
    request({
        method: 'DELETE',
        uri: url,
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 204) {
            callback(err);
        } else {
            callback(err || 'Expected 204 status, received: ' + res.statusCode);
        }
    });
}

var createJob = function(assetId, encoder, callback) {
  console.log( arguments.callee.name );
    callback = callback || function () {};
    var url = base_url + "Assets('" + encodeURIComponent(assetId) + "')";
    var data = {
        'Name': 'EncodeVideo-' + uuid(),
        'InputMediaAssets': [{'__metadata': {'uri': url}}],
        'Tasks': [{
            'Configuration': encoder,
            'MediaProcessorId': mediaProcessorId,
            'TaskBody': "<?xml version=\"1.0\" encoding=\"utf-8\"?><taskBody><inputAsset>JobInputAsset(0)</inputAsset><outputAsset>JobOutputAsset(0)</outputAsset></taskBody>"
        }]
    }
    request.post({
        uri: base_url + "Jobs",
        headers: headers,
        body: JSON.stringify(data),
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 201) {
            var jobId = JSON.parse(res.body).d.Id;
            callback(err, jobId);
        } else {
            callback(err || ': Expected 201 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var getEncodeStatus = function(jobId, callback) {
  console.log( arguments.callee.name );
    request.get({
        uri: base_url + "Jobs('" + encodeURIComponent(jobId) + "')/State",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 200) {
            var encodeStatus = JSON.parse(res.body).d.State;
            callback(err, encodeStatus)
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

var getOutputAsset = function(jobId, callback) {
  console.log( arguments.callee.name );
    request.get({
        uri: base_url + "Jobs('" + encodeURIComponent(jobId) + "')/OutputMediaAssets",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 200) {
            var outputAssetId = JSON.parse(res.body).d.results[0].Id;
            pendingRequests[outputAssetId] = {'assetId': outputAssetId};
            callback(err, outputAssetId)
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

// Not used
var getFileName = function(assetId, streamingURL, callback) {
  console.log( arguments.callee.name );
    request.get({
        uri: base_url + "Assets('" + encodeURIComponent(assetId) + "')/Files",
        headers: headers,
        followRedirect: false,
        strictSSL: true
    }, function (err, res) {
        if (res.statusCode == 200) {
            var filename = JSON.parse(res.body).d.results[1].Name;
            callback(err, filename, streamingURL)
        } else {
            callback(err || ': Expected 200 status, received: ' + res.statusCode + '\n' + res.body);
        }
    });
}

module.exports = {
    accessToken: accessToken,
    base_url: base_url,
    headers: headers,
    pendingRequests: pendingRequests,
    getAccessToken: getAccessToken,
    // getRedirectURL: getRedirectURL,
    getMediaProcessors: getMediaProcessors,
    createAsset: createAsset,
    deleteAsset: deleteAsset,
    createAssetFile: createAssetFile,
    updateAssetFile: updateAssetFile,
    createPolicy: createPolicy,
    deletePolicy: deletePolicy,
    createLocator: createLocator,
    deleteLocator: deleteLocator,
    createJob: createJob,
    getEncodeStatus: getEncodeStatus,
    getOutputAsset: getOutputAsset,
    getFileName: getFileName,
};
