import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  File, 
  Image, 
  FileText, 
  Archive, 
  Music, 
  Video,
  X,
  Download,
  Eye,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { MailAttachment } from '@/types/mail';
import { cn } from '@/lib/utils';

export interface AttachmentUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
}

export interface AttachmentListProps {
  attachments: MailAttachment[];
  onDownload: (attachment: MailAttachment) => void;
  onDelete?: (attachmentId: string) => void;
  onPreview?: (attachment: MailAttachment) => void;
  showActions?: boolean;
}

export interface AttachmentPreviewProps {
  attachment: MailAttachment;
  onClose: () => void;
}

export function AttachmentUpload({ 
  onUpload, 
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  acceptedTypes = ['*/*'],
  disabled = false
}: AttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File ${file.name} is too large. Maximum size is ${formatFileSize(maxFileSize)}`;
    }
    
    if (acceptedTypes[0] !== '*/*' && !acceptedTypes.some(type => file.type.match(type.replace('*', '.*')))) {
      return `File ${file.name} has invalid type. Accepted types: ${acceptedTypes.join(', ')}`;
    }
    
    return null;
  };

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files);
    
    if (fileArray.length > maxFiles) {
      setErrors([`Too many files. Maximum ${maxFiles} files allowed.`]);
      return;
    }

    const newErrors: string[] = [];
    const validFiles: File[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    setErrors(newErrors);

    if (validFiles.length > 0) {
      try {
        // Simulate upload progress
        const progressMap: Record<string, number> = {};
        for (const file of validFiles) {
          progressMap[file.name] = 0;
        }
        setUploadProgress(progressMap);

        // Animate progress
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 50));
          const updatedProgress: Record<string, number> = {};
          for (const file of validFiles) {
            updatedProgress[file.name] = i;
          }
          setUploadProgress(updatedProgress);
        }

        await onUpload(validFiles);
        setUploadProgress({});
      } catch (error) {
        setErrors([`Upload failed: ${error}`]);
        setUploadProgress({});
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-lg font-medium">Drop files here or click to upload</p>
          <p className="text-sm text-muted-foreground">
            Maximum {maxFiles} files, up to {formatFileSize(maxFileSize)} each
          </p>
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          Select Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ))}
        </div>
      )}

      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploading files...</p>
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{filename}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentList({ 
  attachments, 
  onDownload, 
  onDelete, 
  onPreview,
  showActions = true 
}: AttachmentListProps) {
  const getFileIcon = (contentType: string, filename: string) => {
    const type = contentType.toLowerCase();
    const name = filename.toLowerCase();

    if (type.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return <Image className="h-4 w-4" />;
    }
    if (type.startsWith('text/') || name.match(/\.(txt|md|json|xml|csv)$/)) {
      return <FileText className="h-4 w-4" />;
    }
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="h-4 w-4" />;
    }
    if (type.includes('zip') || type.includes('rar') || type.includes('7z') || name.match(/\.(zip|rar|7z)$/)) {
      return <Archive className="h-4 w-4" />;
    }
    if (type.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|flac)$/)) {
      return <Music className="h-4 w-4" />;
    }
    if (type.startsWith('video/') || name.match(/\.(mp4|avi|mkv|mov)$/)) {
      return <Video className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No attachments</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <Card key={attachment.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="text-muted-foreground">
                {getFileIcon(attachment.contentType, attachment.filename)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.filename}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(attachment.size)}</span>
                  <Badge variant="secondary" className="text-xs">
                    {attachment.contentType}
                  </Badge>
                </div>
              </div>
            </div>
            
            {showActions && (
              <div className="flex items-center gap-1">
                {onPreview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreview(attachment)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownload(attachment)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(attachment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AttachmentPreview({ attachment, onClose }: AttachmentPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        if (attachment.contentType.startsWith('text/')) {
          // For text files, fetch and display content
          const response = await fetch(`/api/attachments/${attachment.id}/content`);
          if (response.ok) {
            const text = await response.text();
            setContent(text);
          } else {
            setError('Failed to load content');
          }
        }
      } catch (err) {
        setError('Failed to load preview');
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [attachment.id, attachment.contentType]);

  const isImage = attachment.contentType.startsWith('image/');
  const isText = attachment.contentType.startsWith('text/');
  const isPdf = attachment.contentType === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg truncate">{attachment.filename}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {isImage && (
                <div className="text-center">
                  <img 
                    src={`data:${attachment.contentType};base64,${attachment.content}`}
                    alt={attachment.filename}
                    className="max-w-full max-h-[60vh] mx-auto rounded-lg"
                  />
                </div>
              )}
              
              {isText && (
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-[60vh]">
                    {content}
                  </pre>
                </div>
              )}
              
              {isPdf && (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">PDF preview not available</p>
                  <Button variant="outline" className="mt-4">
                    Download PDF
                  </Button>
                </div>
              )}
              
              {!isImage && !isText && !isPdf && (
                <div className="text-center py-8">
                  <File className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {attachment.contentType} • {attachment.size} bytes
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
