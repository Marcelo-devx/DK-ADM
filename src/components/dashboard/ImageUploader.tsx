import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, UploadCloud, X, AlertCircle, Cloud, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
  initialUrl?: string | null;
  label?: string;
  accept?: string;
  className?: string;
  maxPx?: number;
  quality?: number;
  maxSizeKB?: number;
}

type UploadDestination = "cloudinary" | "supabase";

const isVideo = (url: string) => {
  if (!url) return false;
  return /\.(mp4|webm|ogg)$/i.test(url);
};

const compressImage = (file: File, maxPx = 900, quality = 0.78): Promise<string> => {
  const isPng = file.type === 'image/png';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro ao carregar a imagem.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) {
            height = Math.round((height * maxPx) / width);
            width = maxPx;
          } else {
            width = Math.round((width * maxPx) / height);
            height = maxPx;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não disponível.'));
        ctx.drawImage(img, 0, 0, width, height);
        // PNG preserva transparência; JPEG comprime melhor para fotos
        resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const dataURLtoBlob = (dataURL: string): Blob => {
  const [header, data] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
};

const uploadToCloudinary = async (base64data: string): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(
    'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/cloudinary-upload',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ image: base64data }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Erro ${response.status} no servidor.`);
  if (data?.error) throw new Error(data.error);
  if (!data?.secure_url) throw new Error(data?.details || 'Cloudinary não retornou uma URL válida.');

  return data.secure_url;
};

const uploadToSupabase = async (base64data: string, originalFileName: string): Promise<string> => {
  const blob = dataURLtoBlob(base64data);
  const isPng = base64data.startsWith('data:image/png');
  const ext = isPng ? 'png' : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filePath = `products/${fileName}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(filePath, blob, { contentType: isPng ? 'image/png' : 'image/jpeg', upsert: false });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrl;
};

export const ImageUploader = ({
  onUploadSuccess,
  onUploadStart,
  onUploadError,
  initialUrl,
  label,
  accept = "image/png, image/jpeg, image/webp",
  className,
  maxPx = 900,
  quality = 0.78,
  maxSizeKB = 2000,
}: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(initialUrl || null);
  const [destination, setDestination] = useState<UploadDestination>("cloudinary");
  const lastInitialUrl = useRef(initialUrl);

  // Sync when parent changes initialUrl (e.g. different product opened)
  useEffect(() => {
    if (initialUrl !== lastInitialUrl.current) {
      lastInitialUrl.current = initialUrl;
      setDisplayUrl(initialUrl || null);
      setUploadError(null);
    }
  }, [initialUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    onUploadStart?.();

    try {
      const base64data = await compressImage(file, maxPx, quality);
      const sizeKB = Math.round(base64data.length / 1024);

      if (sizeKB > maxSizeKB) {
        throw new Error('Imagem muito grande. Use uma imagem menor.');
      }

      let url: string;
      if (destination === "supabase") {
        url = await uploadToSupabase(base64data, file.name);
      } else {
        url = await uploadToCloudinary(base64data);
      }

      lastInitialUrl.current = url;
      setDisplayUrl(url);
      onUploadSuccess(url);
      showSuccess("Arquivo enviado com sucesso!");
    } catch (err: any) {
      let errorMsg = err?.message || 'Falha no upload do arquivo.';
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
      }
      setUploadError(errorMsg);
      showError(errorMsg);
      onUploadError?.(errorMsg);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemove = () => {
    lastInitialUrl.current = null;
    setDisplayUrl(null);
    setUploadError(null);
    onUploadSuccess("");
  };

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm">{label || "Arquivo"}</label>

      {/* Seletor de destino */}
      <div className="flex gap-2 mb-1">
        <button
          type="button"
          onClick={() => setDestination("cloudinary")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
            destination === "cloudinary"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
          )}
        >
          <Cloud className="h-3.5 w-3.5" />
          Cloudinary
        </button>
        <button
          type="button"
          onClick={() => setDestination("supabase")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
            destination === "supabase"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300"
          )}
        >
          <Database className="h-3.5 w-3.5" />
          Supabase
        </button>
      </div>

      {displayUrl ? (
        <div className="space-y-1.5">
          <div className={cn("relative border rounded-md bg-gray-50 w-full max-w-[300px] h-[300px]", className)}>
            {isVideo(displayUrl) ? (
              <video
                key={displayUrl}
                src={displayUrl}
                className="absolute inset-0 w-full h-full object-contain"
                autoPlay loop muted playsInline
              />
            ) : (
              <img
                key={displayUrl}
                src={displayUrl}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 z-10 shadow-md"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {(() => {
            if (displayUrl.includes("supabase.co")) {
              return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <Database className="h-3 w-3" /> Supabase Storage
                </span>
              );
            }
            if (displayUrl.includes("cloudinary.com")) {
              return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-600 border border-blue-200">
                  <Cloud className="h-3 w-3" /> Cloudinary
                </span>
              );
            }
            return null;
          })()}
        </div>
      ) : (
        <div className={cn(
          "relative flex flex-col items-center justify-center border-2 border-dashed rounded-md bg-gray-50/50 hover:bg-gray-50 transition-colors w-full max-w-[300px] h-[300px]",
          uploading && "cursor-not-allowed opacity-60",
          uploadError && "border-red-300 bg-red-50/50",
          className
        )}>
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-xs text-muted-foreground font-medium">
                Enviando para {destination === "supabase" ? "Supabase" : "Cloudinary"}...
              </p>
            </>
          ) : (
            <>
              <UploadCloud className={cn("h-8 w-8", uploadError ? "text-red-400" : "text-muted-foreground")} />
              <p className="mt-2 text-xs text-muted-foreground font-medium text-center px-4">
                {uploadError ? "Clique para tentar novamente" : "Arraste ou clique para enviar"}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                → {destination === "supabase" ? "Supabase Storage" : "Cloudinary"}
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

      {uploadError && (
        <div className="flex items-start gap-2 text-xs text-red-600 mt-1 px-1">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};
