const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');

const uploadsRoot = path.join(__dirname, '..', 'uploads');

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const sanitizeFileName = (name = 'image') =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';

const saveLocalFile = async (file, folder = '') => {
  const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const baseName = sanitizeFileName(path.basename(file.originalname || 'image', extension));
  const uniqueName = `${baseName}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

  const normalizedFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
  const targetDir = normalizedFolder ? path.join(uploadsRoot, normalizedFolder) : uploadsRoot;
  await fs.promises.mkdir(targetDir, { recursive: true });

  const absolutePath = path.join(targetDir, uniqueName);
  await fs.promises.writeFile(absolutePath, file.buffer);

  const publicPath = normalizedFolder
    ? `/uploads/${normalizedFolder}/${uniqueName}`
    : `/uploads/${uniqueName}`;

  return {
    url: publicPath,
    provider: 'local',
  };
};

const uploadToCloudinary = (file, folder = '') =>
  new Promise((resolve, reject) => {
    const options = {
      folder,
      resource_type: 'image',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        url: result.secure_url,
        provider: 'cloudinary',
        publicId: result.public_id,
      });
    });

    stream.end(file.buffer);
  });

const uploadLocalPathToCloudinary = (filePath, options = {}) => {
  if (!cloudinaryConfigured) {
    throw new Error('Cloudinary is not configured');
  }

  const folder = String(options.folder || '').replace(/^\/+|\/+$/g, '');

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      {
        folder,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          provider: 'cloudinary',
          publicId: result.public_id,
        });
      }
    );
  });
};

const parseCloudinaryPublicId = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) {
    return null;
  }

  const uploadMarker = '/upload/';
  const markerIndex = url.indexOf(uploadMarker);
  if (markerIndex === -1) {
    return null;
  }

  let remainder = url.slice(markerIndex + uploadMarker.length);

  // Remove transformation segments if present.
  if (!remainder.startsWith('v')) {
    const versionSegmentIndex = remainder.lastIndexOf('/v');
    if (versionSegmentIndex !== -1) {
      remainder = remainder.slice(versionSegmentIndex + 1);
    }
  }

  remainder = remainder.replace(/^v\d+\//, '');

  const extensionIndex = remainder.lastIndexOf('.');
  if (extensionIndex === -1) {
    return remainder;
  }

  return remainder.slice(0, extensionIndex);
};

const deleteFromCloudinary = async (url) => {
  const publicId = parseCloudinaryPublicId(url);
  if (!publicId || !cloudinaryConfigured) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    // Ignore cleanup failures so delete flows continue.
  }
};

const deleteLocalFile = async (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') {
    return;
  }

  const uploadsIndex = imagePath.indexOf('/uploads/');
  if (uploadsIndex === -1) {
    return;
  }

  const relativePath = imagePath.slice(uploadsIndex + 1);
  const absolutePath = path.join(__dirname, '..', relativePath);

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    // Ignore cleanup failures so delete flows continue.
  }
};

const uploadImage = async (file, options = {}) => {
  if (!file || !file.buffer) {
    throw new Error('Invalid upload file');
  }

  const folder = String(options.folder || '').replace(/^\/+|\/+$/g, '');

  if (cloudinaryConfigured) {
    return uploadToCloudinary(file, folder);
  }

  return saveLocalFile(file, folder);
};

const deleteImageAsset = async (imagePathOrUrl) => {
  if (!imagePathOrUrl) {
    return;
  }

  if (/^https?:\/\//i.test(imagePathOrUrl)) {
    await deleteFromCloudinary(imagePathOrUrl);
    return;
  }

  await deleteLocalFile(imagePathOrUrl);
};

module.exports = {
  uploadImage,
  uploadLocalPathToCloudinary,
  deleteImageAsset,
  cloudinaryConfigured,
};
