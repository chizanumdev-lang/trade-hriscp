import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X } from 'lucide-react';

// Setup react-pdf worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export function DocumentViewerModal({ 
  isOpen, 
  onClose, 
  fileUrl, 
  title = "Document Viewer" 
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  
  const prevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const nextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between sticky top-0 bg-background z-10">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Page {pageNumber} of {numPages || '--'}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={zoomOut} disabled={scale <= 0.5}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="icon" onClick={zoomIn} disabled={scale >= 3.0}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2"></div>
            <Button variant="outline" size="icon" onClick={prevPage} disabled={pageNumber <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextPage} disabled={pageNumber >= (numPages || 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/30 p-4 flex justify-center items-start">
          {fileUrl ? (
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="animate-pulse flex space-x-4">Loading document...</div>}
              error={<div className="text-destructive">Failed to load PDF file.</div>}
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-xl bg-white"
              />
            </Document>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No document provided
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
