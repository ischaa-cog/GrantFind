import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import XHRUpload from "@uppy/xhr-upload";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import "../uppy-styles.css";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy<Record<string, unknown>, Record<string, unknown>>({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      // Plain PUT to a signed URL. Supabase Storage doesn't return the ETag
      // header the S3 uploader waits for, which left uploads stuck at 100%.
      .use(XHRUpload, {
        method: "PUT",
        formData: false,
        endpoint: async () => (await onGetUploadParameters()).url,
        headers: (file) => ({ "Content-Type": file.type || "application/octet-stream" }),
        getResponseData: (xhr) => ({ url: xhr.responseURL }),
      })
      .on("complete", (result) => {
        onComplete?.(result);
      })
  );

  // Handle Escape key to close only the file upload modal
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        e.stopPropagation(); // Prevent closing parent dialogs
        setShowModal(false);
      }
    };

    if (showModal) {
      window.addEventListener('keydown', handleEscapeKey, true); // Use capture phase
      return () => window.removeEventListener('keydown', handleEscapeKey, true);
    }
  }, [showModal]);

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className={buttonClassName} type="button">
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
        closeModalOnClickOutside={false}
        showRemoveButtonAfterComplete={true}
      />
    </div>
  );
}
