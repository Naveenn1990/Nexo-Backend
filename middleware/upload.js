const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
const fullUploadPath = path.join(__dirname, '..', uploadDir);
if (!fs.existsSync(fullUploadPath)) {
    fs.mkdirSync(fullUploadPath, { recursive: true });
}

// Create banners subdirectory if it doesn't exist
const bannerPath = path.join(fullUploadPath, 'banners');
if (!fs.existsSync(bannerPath)) {
    fs.mkdirSync(bannerPath, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Choose destination based on route
        const dest = req.originalUrl.includes('/banners') ? bannerPath : fullUploadPath;
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + path.extname(file.originalname);
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
    if (filename.includes('https://wavetechservices.in/uploads/')) {
        return filename.replace('https://wavetechservices.in/uploads/', '');
    }
    if (filename.includes('https://wavetechservices.in/')) {
        return filename.replace('https://wavetechservices.in/', '');
    }
    if (filename.includes('/')) {
        return filename.split('/').pop();
    }
    return filename;
};

module.exports = { upload, processFilePath, stripUrl };
