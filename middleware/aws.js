const AWS = require("aws-sdk");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { promisify } = require("util");
dotenv.config();

// Configure AWS SDK v2
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3Client = new AWS.S3();


const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const streamPipeline = promisify(pipeline);
// if (!fs.existsSync(DOWNLOAD_DIR)) {  
//   fs.mkdirSync(DOWNLOAD_DIR);
// }

const downloadAllImages = async (bucketName = process.env.AWS_S3_BUCKET_NAME) => {
  try {
    const listParams = {
      Bucket: bucketName,
    };

    const listData = await s3Client.listObjectsV2(listParams).promise();

    if (!listData.Contents || listData.Contents.length === 0) {
      console.log("No files found in bucket.");
      return;
    }

    const imageFiles = listData.Contents.filter((file) =>
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.Key)
    );

    console.log(`Found ${imageFiles.length} image(s). Downloading...`);

    for (const file of imageFiles) {
      const localPath = path.join(DOWNLOAD_DIR, file.Key);
      const localDir = path.dirname(localPath);

      // Create folder structure if not exists
      fs.mkdirSync(localDir, { recursive: true });

      const getObjectParams = {
        Bucket: bucketName,
        Key: file.Key,
      };

      const data = s3Client.getObject(getObjectParams).createReadStream();

      await streamPipeline(data, fs.createWriteStream(localPath));
      console.log(`Downloaded: ${file.Key}`);
    }

    console.log("✅ All images downloaded successfully.");
  } catch (err) {
    console.error("❌ Error downloading images:", err);
  }
};


const uploadFile = (file, bucketname) => {
  return new Promise((resolve, reject) => {
    // const file = files.image[0];
    // console.log(file,bucketname);
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `${bucketname}/${Date.now() + "_" + file.originalFilename}`,
      Body: fs.createReadStream(file.filepath),
      ContentType: file.mimetype,
    };
    s3Client.putObject(params, (err, data) => {
      if (err) {
        reject("File not uploaded");
      } else {
        // console.log(data);
        let location = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${params.Key}`;
        console.log(location);
        resolve(location);
      }
    });
  });
};

// const uploadFile2 = (file, bucketname) => {
//   return new Promise((resolve, reject) => {
//     // const file = files.image[0];
//     // console.log(file,bucketname);
//     const params = {
//       Bucket: process.env.AWS_S3_BUCKET_NAME,
//       Key: `${bucketname}/${Date.now() + "_" + file.originalname}`,
//       Body: file.buffer,
//       ContentType: file.mimetype,
//     };
//     s3Client.putObject(params, (err, data) => {
//       if (err) {
//         reject("File not uploaded");
//       } else {
//         // console.log(data);
//         let location = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${params.Key}`;
//         console.log(location);
//         resolve(location);
//       }
//     });
//   });
// };

const uploadFile2 = (file, bucketname) => {
  return new Promise((resolve, reject) => {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Map bucket names to correct subdirectories
    let subdir = bucketname;
    if (bucketname === 'partnerdoc' || bucketname === 'kyc') {
      subdir = 'kyc';
    } else if (bucketname === 'partner' || bucketname === 'team-member') {
      subdir = 'profiles';
    }

    // Create subdirectory if it doesn't exist
    const bucketDir = path.join(uploadsDir, subdir);
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }

    // Sanitize filename: remove spaces and special characters, keep only alphanumeric, dots, hyphens, and underscores
    const sanitizedOriginalName = file.originalname
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9._-]/g, '');  // Remove special characters except dots, hyphens, underscores
    
    // Generate unique filename with sanitized name
    const filename = `${Date.now()}_${sanitizedOriginalName}`;
    const filePath = path.join(bucketDir, filename);

    // Write file to local storage
    fs.writeFile(filePath, file.buffer, (err) => {
      if (err) {
        reject("File not uploaded");
      } else {
        // Return proper URL for local file access
        let location = `http://localhost:9088/uploads/${subdir}/${filename}`;
        console.log(location);
        resolve(location);
      }
    });
  });
};
const getUrlFileKey = (url) => {
  const regex = /^https?:\/\/([^\.]+)\.s3.amazonaws.com\/(.+)$/;
  const match = url.match(regex);
  if (match) {
    return match[2]; // file key is in group 2
  } else {
    throw new Error(`Invalid S3 URL: ${url}`);
  }
};

const deleteFile = async (url) => {
  
 const fileKey= getUrlFileKey(url)
 console.log(fileKey);
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileKey,
  };

  try {
    const data = await s3Client.deleteObject(params).promise();
    return data;
  } catch (err) {
    throw new Error(`Error deleting file: ${err.message}`);
  }
};

const updateFile = async (fileKey, newFile) => {
  await deleteFile(`https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`); // Delete the old file first

  const params = {
    ACL: "public-read",
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileKey,
    Body: newFile.buffer,
  };

  try {
    const data = await s3Client.putObject(params).promise();
    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`;
  } catch (err) {
    throw new Error(`Error updating file: ${err.message}`);
  }
};

const multifileUpload = async (files, bucketname) => {
  return Promise.all(
    files.map((file) => {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `${bucketname}/${Date.now()}_${file.originalname}`,
        Body: file.buffer,
      };

      return new Promise((resolve, reject) => {
        s3Client.putObject(params, (err, data) => {
          if (err) {
            reject(err);
          } else {
            let location = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${params.Key}`;
            console.log(location);
            resolve(location);
          }
        });
      });
    })
  );
};

// Helper function to handle file uploads for both memoryStorage and diskStorage
const handleFileUpload = async (file, bucketname) => {
  if (!file) return null;
  
  // Check if file has buffer (memoryStorage) or path (diskStorage)
  if (file.buffer) {
    // Using memoryStorage - use uploadFile2 and return the full URL
    const fullUrl = await uploadFile2(file, bucketname);
    return fullUrl; // Return the full URL
  } else if (file.path || file.filename) {
    // Using diskStorage - file is already saved, construct and return full URL
    const filename = file.filename || path.basename(file.path);
    
    // Map bucket names to correct subdirectories
    let subdir = bucketname;
    if (bucketname === 'partnerdoc' || bucketname === 'kyc') {
      subdir = 'kyc';
    } else if (bucketname === 'partner' || bucketname === 'team-member') {
      subdir = 'profiles';
    }
    
    return `http://localhost:9088/uploads/${subdir}/${filename}`;
  }
  
  return null;
};

module.exports= { uploadFile,uploadFile2, deleteFile, updateFile, multifileUpload,downloadAllImages, handleFileUpload };