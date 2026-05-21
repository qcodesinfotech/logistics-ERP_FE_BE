
import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onClear?: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    if (onClear) onClear();
  };

  const save = () => {
    if (sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) {
        alert("Please provide a signature first.");
        return;
      }
      const dataURL = sigCanvas.current.toDataURL('image/png');
      onSave(dataURL);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-dashed border-muted p-2 bg-white">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            className: 'signature-canvas w-full h-40 cursor-crosshair',
            style: { width: '100%', height: '160px' }
          }}
        />
      </Card>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear}>
          Clear
        </Button>
        <Button size="sm" onClick={save}>
          Confirm Signature
        </Button>
      </div>
    </div>
  );
};
