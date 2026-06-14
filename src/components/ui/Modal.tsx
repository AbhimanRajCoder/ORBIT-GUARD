import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;
export const ModalPortal = Dialog.Portal;

export interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  title?: string;
  description?: string;
}

export const ModalContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  ModalContentProps
>(({ className, children, title, description, ...props }, ref) => (
  <Dialog.Portal>
    {/* Backdrop: Void color with high opacity, no blur */}
    <Dialog.Overlay className="fixed inset-0 z-50 bg-void/85 transition-opacity" />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content
        ref={ref}
        className={cn(
          "relative w-full max-w-lg rounded-[6px] border border-iron bg-abyss p-6 text-bone focus:outline-none select-none",
          className
        )}
        {...props}
      >
        {title && (
          <Dialog.Title className="font-display text-[18px] font-semibold uppercase tracking-wide text-bone mb-1">
            {title}
          </Dialog.Title>
        )}
        {description && (
          <Dialog.Description className="font-body text-[13px] text-ash mb-4">
            {description}
          </Dialog.Description>
        )}
        
        {children}

        {/* Close button containing standard Lucide X icon */}
        <Dialog.Close className="absolute right-4 top-4 rounded-[4px] p-1 text-ash hover:text-bone hover:bg-iron transition-colors focus:outline-none cursor-pointer">
          <X className="h-4 w-4" strokeWidth={1.5} />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </div>
  </Dialog.Portal>
));

ModalContent.displayName = "ModalContent";
