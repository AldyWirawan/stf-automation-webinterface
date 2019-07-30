var express = require('express');
var request = require('request');
var fs = require('fs');
var app = express();
var commonHeader = { 'Content-Type': 'html'};

app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies

// RENDER FUNCTION

function mergeValues(values, content) {
	for (var key in values) {
		content = content.replace("{{" + key + "}}", values[key]);
	}
	return content;
}

function view(templateName, values, res) {
	var fileContent = fs.readFileSync('./template/' + templateName + '.html','utf8');
	fileContent = mergeValues(values,fileContent);
	res.write(fileContent);
}

// GET DEVICE THRU STF API

function getDeviceList(callback) {

	var availableDevices = "";

	var stfDevices = {
		url:"http://172.19.14.63:7100/api/v1/devices",
		headers:{
			Authorization: 'Bearer 52da8dabeb7a49a584078e9f6925c4003a7d11e9cb60485f86c3db435a622845'
		},
	}
	
	request.get(stfDevices, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var devices = JSON.parse(body);
			var i;			
			for (i = 0; i < devices.devices.length; i++) {
				if (devices.devices[i].using == false && devices.devices[i].present == true) {
					availableDevices += "<option>" + devices.devices[i].manufacturer + "-" + devices.devices[i].platform + "-" + devices.devices[i].version + "-" + devices.devices[i].serial + "</option>";
				}
			}
			if (availableDevices == "") {
				availableDevices = "no available devices";
				console.log("no available devices");
			}
			callback(availableDevices);
		} else {
			console.log("failed to get device list from STF");
			res.write("failed toget device list from STF, check whether STF on or not");
			res.end();
		}
	});
}

// GET APK THRU TEXT FILE

function getApkList() {
	var fileContent = (String)(fs.readFileSync('./data/apk.txt')).split(/\r?\n/);
	var apk = "";
	for (i=0;i<fileContent.length;i++) {
		apk += "<option>" + fileContent[i].substring(fileContent[i].lastIndexOf('/')+1) + "</option>";
	}
	return apk;
}

// TRIGGER AUTOMATION ON JENKINS

function triggerAutomation(req, res, callback) {
	for (var i=0;i<req.body.devicestring.length;i++) {
		var data = {
			"devicestring" : (String)(req.body.devicestring[i]),
			"apk" : (String)(req.body.apk[i]),
		}
		var jenkinsJob = {
			url:"http://172.19.14.63:8080/job/appautomation/buildWithParameters?token=appautomationexec",
			headers:{
				Authorization: "Basic YXV0bzphdXRv",
			},
			form: data,
		}

		request.post(jenkinsJob, function(error, response, body){
			if (!error && response.statusCode == 200) {
				callback();
			}
		})
	}
	
}

// ROUTING

app.get('/', function (req, res) {

	// render
	getDeviceList(function (availableDevices) {
		console.log (availableDevices);
		var values = {
			devices: availableDevices,
			apk: getApkList(),
			link: "<iframe src=\"http://172.19.14.63:7100\" style=\"border: 0; width:100%; height: 100%;\" align=\"left\">Your browser doesn't support iFrames.<\/iframe>",
		}
		res.writeHead(200, commonHeader);
		view("automation", values, res);
		res.end();
	});
});

app.post('/', function (req,res) {
	
	// check duplicate device or null device while saving control url
	var dict = {};
	var controlUrl = [];
	if (req.body.devicestring != null) {
		for (var i=0;i<req.body.devicestring.length;i++){
			if (dict[req.body.devicestring[i]] == null && req.body.devicestring[i] != null) {
				dict[req.body.devicestring[i]] = 1;
				controlUrl.push("http://172.19.14.63:7100/#!/control/" + (String)(req.body.devicestring[i]).split('-')[3]);
			} else {
				res.writeHead(302, {
					'Location':'/'
				});
				res.end();
				break;
			}
		}

		// set iframe
		var iframestring = "";
		for (var i=0;i<controlUrl.length;i++){
			if (i % 2 == 0) {var align = "left";} else {var align = "right";}
			iframestring+="<iframe src=\"" + controlUrl[i] + "\" style=\"border:0; width:50%; height:100%;\" align=\"" + align + "\">Your browser doesn't support iFrames.<\/iframe>";
		}
		console.log(iframestring);

		// render view
		var values = {
			apk: getApkList(),
			link: iframestring,
		}

		res.writeHead(200, commonHeader);
		view("automation", values, res);
		res.end();
		
		triggerAutomation(req,res,function() {
			console.log("done");
		});
	} else {
		res.write("null devices!");
		res.end();
	}
});

app.listen(80, function () {
  	console.log('Example app listening on port 80!');
});