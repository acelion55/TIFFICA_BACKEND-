const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const auth = require('./authmiddle');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('🔧 Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✓' : '✗',
  api_key: process.env.CLOUDINARY_API_KEY ? '✓' : '✗',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✓' : '✗'
});

// Test endpoint
router.get('/test', (req, res) => {
  console.log('🧪 [TEST] Cloudinary config check');
  res.json({
    cloudinary_configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✓' : '✗',
    api_key: process.env.CLOUDINARY_API_KEY ? '✓' : '✗',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '✓' : '✗'
  });
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024
  }
});

// Upload image endpoint
router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
  try {
    console.log('📸 [UPLOAD-IMAGE] Request received');
    console.log('📸 [UPLOAD-IMAGE] User ID:', req.userId);
    
    if (!req.file) {
      console.log('❌ [UPLOAD-IMAGE] No file provided');
      console.log('Request body:', req.body);
      console.log('Request files:', req.files);
      return res.status(400).json({ 
        success: false,
        error: 'No image file provided',
        details: 'Please select an image to upload'
      });
    }

    console.log('📸 [UPLOAD-IMAGE] File info:', {
      name: req.file.originalname,
      size: (req.file.size / 1024).toFixed(2) + ' KB',
      type: req.file.mimetype,
      buffer: req.file.buffer ? 'Present' : 'Missing'
    });

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      console.log('❌ [UPLOAD-IMAGE] Invalid file type:', req.file.mimetype);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type',
        details: 'Only image files are allowed'
      });
    }

    console.log('⏳ [UPLOAD-IMAGE] Starting Cloudinary upload...');
    
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'tiffica-menu',
          resource_type: 'image',
          quality: 'auto',
          fetch_format: 'auto',
          transformation: [
            { width: 800, height: 600, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('❌ [UPLOAD-IMAGE] Cloudinary error:', error);
            reject(error);
          } else {
            console.log('✅ [UPLOAD-IMAGE] Cloudinary success:', result.secure_url);
            resolve(result);
          }
        }
      );

      uploadStream.on('error', (error) => {
        console.error('❌ [UPLOAD-IMAGE] Stream error:', error);
        reject(error);
      });

      uploadStream.end(req.file.buffer);
    });

    const result = await uploadPromise;

    console.log('✅ [UPLOAD-IMAGE] Sending response with URL:', result.secure_url);
    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height
    });

  } catch (error) {
    console.error('❌ [UPLOAD-IMAGE] Error:', error.message);
    console.error('❌ [UPLOAD-IMAGE] Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload image',
      details: error.message 
    });
  }
});

// Upload video endpoint
router.post('/upload-video', auth, upload.single('video'), async (req, res) => {
  try {
    console.log('📹 [UPLOAD-VIDEO] Request received');
    
    if (!req.file) {
      console.log('❌ [UPLOAD-VIDEO] No file provided');
      return res.status(400).json({ error: 'No video file provided' });
    }

    console.log('📹 [UPLOAD-VIDEO] File info:', {
      name: req.file.originalname,
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: req.file.mimetype
    });

    console.log('⏳ [UPLOAD-VIDEO] Starting Cloudinary upload...');

    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'tiffica-videos',
          resource_type: 'video',
          quality: 'auto',
          eager_async: true
        },
        (error, result) => {
          if (error) {
            console.error('❌ [UPLOAD-VIDEO] Cloudinary error:', error);
            reject(error);
          } else {
            console.log('✅ [UPLOAD-VIDEO] Cloudinary success:', result.secure_url);
            resolve(result);
          }
        }
      );

      uploadStream.on('error', (error) => {
        console.error('❌ [UPLOAD-VIDEO] Stream error:', error);
        reject(error);
      });

      uploadStream.end(req.file.buffer);
    });

    const result = await uploadPromise;

    console.log('✅ [UPLOAD-VIDEO] Sending response');
    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      size: result.bytes
    });

  } catch (error) {
    console.error('❌ [UPLOAD-VIDEO] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to upload video',
      details: error.message 
    });
  }
});

// Delete image from Cloudinary
router.delete('/delete/:publicId', auth, async (req, res) => {
  try {
    const publicId = req.params.publicId.replace(/-/g, '/');
    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('❌ Image delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Delete video from Cloudinary
router.delete('/delete-video/:publicId', auth, async (req, res) => {
  try {
    const publicId = req.params.publicId.replace(/-/g, '/');
    console.log('🗑️ Deleting video:', publicId);
    
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    
    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    console.error('❌ Video delete error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

module.exports = router;
