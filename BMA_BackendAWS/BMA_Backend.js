// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var util = require('util');
var s3 = require('aws2js').load('s3', awsAccessKeyId, awsSecretAccessKey);


// get reference to S3 client
var s3 = new AWS.S3();

exports.handler = function(event, context) {
	// Read options from the event.
	console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
	var srcBucket = event.Records[0].s3.bucket.name;
  s3.setBucket(srcBucket); //NOTE:this is where the download all the keys bucket is set

	// Object key may have spaces or unicode non-ASCII characters.
  var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

	// Sanity check: validate that source and destination are different buckets.
	if (srcBucket == dstBucket) {
		console.error("Destination bucket must not match source bucket.");
		return;
	}

	// Infer the image type.
	var typeMatch = srcKey.match(/\.([^.]*)$/);
	if (!typeMatch) {
		console.error('unable to infer image type for key ' + srcKey);
		return;
	}
	//TODO: might want to change the type of the file that will be uploaded, something like .map .cfg
	var imageType = typeMatch[1];
	if (imageType != "jpg" && imageType != "png") {
		console.log('skipping non-image ' + srcKey);
		return;
	}
	//downloads entire bucket
  //TODO:Need to set the url for the bucket
  //NOTE:Data contains a list of all objects in the bucket
  var folder = encodeURI('some/path/to/S3/folder');
  var url = '?prefix=' + folder;

  s3.get(url, 'xml', function (error, data) {
      console.log(error);
      console.log(data);
  });

  //Below is where we set the contents of each file to an item in the values object
  var values = [];
  async.each(data, function(file, callback) {
    //Adds the body of the file to the values list
    console.log('Processing file ' + file);
    var params = {Bucket: srcBucket, Key: data};
    var s3file = s3.getObject(params);
    var values.unshift(s3file);
  }, function(err){
    // if any of the file processing produced an error, err would equal that error
    if( err ) {
      // One of the iterations produced an error.
      // All processing will now stop.
      console.log('A file failed to process');
    } else {
      console.log('All files have been processed successfully');
    }
  });

	//Parse the xml to add them to the content array
	var content = [];
	var parseString = require('xml2js').parseString;
	async.each(values, function(err, result){
		parseString(values, function (err, result) {
			//here is where we parse each object
			var content.push(result);
		});
	});
	//TODO: Need to figure out how data is laid out so that I can parse it
	//TODO: if all the data is store squentially then, pop off what you dont need, the definition of xml part, then sort based on name
	//TODO: Need to setup sort such that it skips the two lat, lng for each point.
  /**
  /////////////////NOTE/////////////////////
  Each element of the list is laid out as so:
    <place>Name</place> <-- Could have multiple entries with the same name
    <lat>123.123</lat>
    <lng>321.321</lng>
  -Need to sort the elements of this list by NAME
  -After they are sorted by NAME need to count and see if there are X with the same name (setting all characters in the name to lowercase)
    -if there are X of the same name
      -set the first one as the starting point
      -compare the lat with the starting point
        -if same check lng
          -if lng are the same add that point to the list TOBEADDED to verified list
          -else move on
        -else move on
  */



	// Download the image from S3, transform, and upload to a different S3 bucket.
	async.waterfall([
		//TODO:Here is where I do the comparison work
		function compare(next) {
			//gm(response.Body).size(function(err, size) {
				// Infer the scaling factor to avoid stretching the image unnaturally.
			//	var scalingFactor = Math.min(
			//		MAX_WIDTH / size.width,
			//		MAX_HEIGHT / size.height
			//	);
			//	var width  = scalingFactor * size.width;
			//	var height = scalingFactor * size.height;

				// Transform the image buffer in memory.
			//	this.resize(width, height)
			//		.toBuffer(imageType, function(err, buffer) {
			//			if (err) {
			//				next(err);
			//			} else {
			//				next(null, response.ContentType, buffer);
			//			}
			//		});
			//});
		//TODO: Needs to compare all keys in the object and if it finds 5 of the same keys or more it adds them to the verified list
		//First: Needs to sort object using a quick sort

		},
		function upload(contentType, data, next) {
			// Stream the transformed image to a different S3 bucket.
			s3.putObject({
					Bucket: dstBucket,
					Key: dstKey,
					Body: data,
					ContentType: contentType
				},
				next);
			}
		], function (err) {
			if (err) {
				console.error(
					'Unable to resize ' + srcBucket + '/' + srcKey +
					' and upload to ' + dstBucket + '/' + dstKey +
					' due to an error: ' + err
				);
			} else {
				console.log(
					'Successfully resized ' + srcBucket + '/' + srcKey +
					' and uploaded to ' + dstBucket + '/' + dstKey
				);
			}

			context.done();
		}
	);
};
