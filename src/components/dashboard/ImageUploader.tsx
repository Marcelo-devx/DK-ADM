import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  initialUrl?: string | null;
  label?: string;
  accept?: string;
  className?: string;
}

const isVideo = (url: string) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg)$/i.test(url);
}

export const ImageUploader = ({ 
    onUploadSuccess, 
    initialUrl, 
    label, 
    accept = "image/png, image/jpeg, image/webp",
    className
}: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(initialUrl || null);

  useEffect(() => {
    setMediaUrl(initialUrl || null);
  }, [initialUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
        // First attempt: use the Cloudinary edge function (preferred)
        const { data, error } = await supabase.functions.invoke("cloudinary-upload", {
          body: { image: base64data },
        });

        if (error || !data?.secure_url) {
          throw error || new Error('Cloudinary upload did not return a secure_url');
        }

        const { secure_url } = data;
        setMediaUrl(secure_url);
        onUploadSuccess(secure_url);
        showSuccess("Arquivo enviado com sucesso!");
      } catch (err: any) {
        console.error("Cloudinary upload failed, attempting Supabase Storage fallback:", err);
        // Fallback: upload directly to Supabase Storage public bucket
        try {
          // Try common bucket names in order
          const bucketCandidates = ['public', 'images', 'uploads'];
          let uploadedUrl: string | null = null;

          for (const bucket of bucketCandidates) {
            try {
              const filePath = `${Date.now()}_${file.name}`;
              const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
              if (uploadError) {
                console.warn(`Upload to bucket ${bucket} failed:`, uploadError.message);
                continue; // try next bucket
              }

              const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
              if (publicData?.publicUrl) {
                uploadedUrl = publicData.publicUrl;
                break;
              }
            } catch (innerErr) {
              console.warn('Fallback upload attempt error:', innerErr);
              continue;
            }
          }

          if (!uploadedUrl) {
            throw new Error('Fallback upload failed: no bucket available or permission denied');
          }

          setMediaUrl(uploadedUrl);
          onUploadSuccess(uploadedUrl);
          showSuccess('Arquivo enviado via Supabase Storage!');
        } catch (fallbackErr: any) {
          console.error('Both upload methods failed:', fallbackErr);
          showError(fallbackErr.message || 'Falha no upload do arquivo.');
        }
      } finally {
        setUploading(false);
      }
    };
  };
  
  const handleRemoveMedia = () => {
    setMediaUrl(null);
    onUploadSuccess(""); // Limpa a URL no formulário pai
  };

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm">{label || "Arquivo"}</label>
      {mediaUrl ? (
        <div className={cn(
          "relative border rounded-md overflow-hidden bg-gray-50 flex items-center justify-center",
          "aspect-square w-full max-w-[300px]", // Define como quadrado e limita o tamanho máximo
          className
        )}>
          {isVideo(mediaUrl) ? (
            <video
              key={mediaUrl}
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 z-10 shadow-md"
            onClick={handleRemoveMedia}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className={cn(
          "relative flex flex-col items-center justify-center border-2 border-dashed rounded-md bg-gray-50/50 hover:bg-gray-50 transition-colors",
          "aspect-square w-full max-w-[300px]", // Define como quadrado e limita o tamanho máximo
          uploading && "cursor-not-allowed opacity-60",
          className
        )}>
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-xs text-muted-foreground font-medium">Enviando...</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground font-medium text-center px-4">
                Arraste ou clique para enviar
              </p>
              <Input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept={accept}
                disabled={uploading}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};