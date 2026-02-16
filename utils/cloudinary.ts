
export const CLOUDINARY_CLOUD_NAME = 'dyi70w8ds';
export const CLOUDINARY_UPLOAD_PRESET = 'package_uploadsriders';
export const CLOUDINARY_API_KEY = '432531976335292';

export const uploadToCloudinary = async (uri: string, type: 'image' | 'video' | 'audio') => {
    if (!uri) return null;

    const data = new FormData();
    const isAudio = type === 'audio';
    const isVideo = type === 'video';

    data.append('file', {
        uri,
        type: isAudio ? 'audio/m4a' : (isVideo ? 'video/mp4' : 'image/jpeg'),
        name: isAudio ? 'upload.m4a' : (isVideo ? 'upload.mp4' : 'upload.jpg'),
    } as any);

    // Use user-specified preset for chat media if needed, but keeping simple for now
    data.append('upload_preset', 'riderschatmedia'); // Updated preset
    data.append('cloud_name', CLOUDINARY_CLOUD_NAME);

    try {
        const resourceType = (type === 'video' || type === 'audio') ? 'video' : 'image';
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
            method: 'POST',
            body: data,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data',
            },
        });

        const json = await res.json();
        if (json.secure_url) {
            return json.secure_url;
        } else {
            console.error('Cloudinary Upload Error:', json);
            throw new Error(json.error?.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload Exception:', error);
        throw error;
    }
};
