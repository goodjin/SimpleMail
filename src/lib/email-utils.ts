export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validateEmails = (emails: string): { valid: boolean; invalidEmails: string[] } => {
  const emailList = emails
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  const invalidEmails = emailList.filter((email) => !validateEmail(email));
  
  return {
    valid: invalidEmails.length === 0,
    invalidEmails,
  };
};

export const formatEmailList = (emails: string): string[] => {
  return emails
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
