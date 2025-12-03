const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
const fullUploadPath = path.join(__dirname, '..', uploadDir);
if (!fs.existsSync(fullUploadPath)) {
    fs.mkdirSync(fullUploadPath, { recursive: true });
}

// Create subdirectories if they don't exist
const bannerPath = path.join(fullUploadPath, 'banners');
if (!fs.existsSync(bannerPath)) {
    fs.mkdirSync(bannerPath, { recursive: true });
}

const kycPath = path.join(fullUploadPath, 'kyc');
if (!fs.existsSync(kycPath)) {
    fs.mkdirSync(kycPath, { recursive: true });
}

const profilesPath = path.join(fullUploadPath, 'profiles');
if (!fs.existsSync(profilesPath)) {
    fs.mkdirSync(profilesPath, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Choose destination based on route or field name
        let dest = fullUploadPath;
        
        if (req.originalUrl.includes('/banners')) {
            dest = bannerPath;
        } else if (['panCard', 'aadhaar', 'aadhaarback', 'drivingLicence', 'bill', 'chequeImage'].includes(file.fieldname)) {
            // KYC documents go to kyc subdirectory
            dest = kycPath;
        } else if (file.fieldname === 'profilePicture' || file.fieldname === 'profileImage') {
            // Profile pictures go to profiles subdirectory
            dest = profilesPath;
        }
        
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        // Create a clean filename with original name preserved
        const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const filename = `${file.fieldname}-${timestamp}-${cleanOriginalName}`;
        // Store filename in request for easy access
        req.uploadedFilename = filename;
        cb(null, filename);
    }
});

// Create multer upload middleware
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs
        const allowedTypes = /jpeg|jpg|png|gif|pdf|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and PDF files are allowed!'));
        }
    }
});

// Middleware to process uploaded file path
const processFilePath = (req, res, next) => {
    if (req.file) {
        // Use the filename we stored earlier
        req.file.filename = req.uploadedFilename;
        req.file.path = req.uploadedFilename;
    }
    next();
};

// Strip URL from filename
const stripUrl = (filename) => {
    if (!filename) return filename;
    // Handle various URL patterns
    if (filename.includes('https://nexo.works/uploads/')) {
        return filename.replace('https://nexo.works/uploads/', '');
    }
    if (filename.includes('https://nexo.works/')) {
        return filename.replace('https://nexo.works/', '');
    }
    if (filename.includes('/')) {
        return filename.split('/').pop();
    }
    return filename;
};

module.exports = { upload, processFilePath, stripUrl };
