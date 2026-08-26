export const formatImageUrl = (url: string): string => {
  if (!url) return '';
  
  // Normalize backslashes to slashes (fix for Windows paths like public\images\file.png)
  let formattedUrl = url.replace(/\\/g, '/');

  // Robustly handle 'public/' or '/public/' prefix errors
  // This allows users to paste "public/images/file.png" and we convert it to "/images/file.png"
  formattedUrl = formattedUrl.replace(/^\/?public\//, '');

  // Handle Google Drive Viewer links
  // Convert https://drive.google.com/file/d/ID/view?usp=drivesdk to https://drive.google.com/uc?export=view&id=ID
  if (formattedUrl.includes('drive.google.com') && (formattedUrl.includes('/view') || formattedUrl.includes('/file/d/'))) {
    const idMatch = formattedUrl.match(/\/d\/([^/?]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
    }
  }

  // If it's an external URL (http/https) or data URI, return as is
  if (formattedUrl.match(/^(https?:\/\/|data:)/)) {
      return formattedUrl;
  }

  // Handle local images: ensure it starts with /
  if (!formattedUrl.startsWith('/')) {
    formattedUrl = `/${formattedUrl}`;
  }
  
  return formattedUrl;
};