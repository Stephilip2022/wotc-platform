import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, X, CheckCircle, Loader2 } from "lucide-react";
import { useMobileDetect } from "@/hooks/useMobileDetect";

interface CameraFileUploadProps {
  questionId: string;
  onFileChange: (file: File | null) => void;
  uploadedFile: File | null;
  isUploading: boolean;
}

export function CameraFileUpload({
  questionId,
  onFileChange,
  uploadedFile,
  isUploading,
}: CameraFileUploadProps) {
  const { isMobile } = useMobileDetect();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileChange(file);
    }
  };

  const handleRemove = () => {
    onFileChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  if (uploadedFile) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{uploadedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={isUploading}
            data-testid={`button-remove-file-${questionId}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isMobile && (
          <Button
            type="button"
            variant="outline"
            className="w-full h-24 flex flex-col gap-2"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            data-testid={`button-camera-${questionId}`}
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm">Take Photo</span>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              data-testid={`input-camera-${questionId}`}
            />
          </Button>
        )}
        
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 flex flex-col gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          data-testid={`button-upload-${questionId}`}
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm">Choose File</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*"
            onChange={handleFileSelect}
            className="hidden"
            data-testid={`input-file-${questionId}`}
          />
        </Button>
      </div>

      {isUploading && (
        <div className="flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-md">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Uploading...</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Accepted: PDF, JPG, PNG, DOC, DOCX (max 10MB)
      </p>
    </div>
  );
}
