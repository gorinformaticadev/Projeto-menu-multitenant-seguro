import React, { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  X,
  Image,
  Camera,
  FileText,
  User,
  MapPin,
  Sticker
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Mock types for props to avoid excessive any in the future, though JS is loose.
interface ChatInputProps {
  onSend: (msg: { type: string; content: string }) => void;
  onAttachment: (attachment: { type: string; url: string; filename: string }) => void;
  disabled?: boolean;
  quickReplies?: any[];
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  onAttachment,
  disabled = false,
  quickReplies = [],
  placeholder = "Digite uma mensagem"
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [filteredReplies, setFilteredReplies] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (message.startsWith('/')) {
      const search = message.slice(1).toLowerCase();
      const filtered = quickReplies.filter(qr =>
        qr.shortcut.toLowerCase().includes(search) ||
        qr.title?.toLowerCase().includes(search)
      );
      setFilteredReplies(filtered);
    } else {
      setFilteredReplies([]);
    }
  }, [message, quickReplies]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend({ type: 'text', content: message.trim() });
      setMessage('');
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply: any) => {
    setMessage(reply.content);
    setFilteredReplies([]);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      // Mock upload for visualization
      const file_url = URL.createObjectURL(file);
      onAttachment({ type, url: file_url, filename: file.name });
    }
    setShowAttachments(false);
  };

  const attachmentOptions = [
    { icon: FileText, label: 'Documento', type: 'document', accept: '.pdf,.doc,.docx,.xls,.xlsx' },
    { icon: Camera, label: 'Câmera', type: 'camera', accept: 'image/*' },
    { icon: Image, label: 'Fotos e vídeos', type: 'image', accept: 'image/*,video/*' },
    { icon: User, label: 'Contato', type: 'contact' },
    { icon: MapPin, label: 'Localização', type: 'location' },
    { icon: Sticker, label: 'Figurinha', type: 'sticker' },
  ];

  return (
    <div className="bg-[#202c33] px-4 py-3 border-t border-[#2a3942]">
      {/* Quick Replies Suggestions */}
      {filteredReplies.length > 0 && (
        <div className="mb-2 bg-[#2a3942] rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
          {filteredReplies.map((reply) => (
            <button
              key={reply.id}
              onClick={() => handleQuickReply(reply)}
              className="w-full px-4 py-3 text-left hover:bg-[#3b4a54] transition-colors border-b border-[#202c33] last:border-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-[#00a884] text-sm font-medium">/{reply.shortcut}</span>
                {reply.title && <span className="text-[#8696a0] text-sm">- {reply.title}</span>}
              </div>
              <p className="text-[#e9edef] text-sm mt-1 truncate">{reply.content}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Emoji Button */}
        <Button
          variant="ghost"
          size="icon"
          className="text-[#8696a0] hover:text-[#e9edef] hover:bg-transparent flex-shrink-0"
        >
          <Smile className="w-6 h-6" />
        </Button>

        {/* Attachment Button */}
        <Popover open={showAttachments} onOpenChange={setShowAttachments}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-[#8696a0] hover:text-[#e9edef] hover:bg-transparent flex-shrink-0 transition-transform",
                showAttachments && "rotate-45"
              )}
            >
              <Paperclip className="w-6 h-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="bg-[#233138] border-[#2a3942] p-2 w-auto"
          >
            <div className="grid grid-cols-3 gap-2">
              {attachmentOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => {
                    if (option.accept) {
                      fileInputRef.current?.setAttribute('accept', option.accept);
                      fileInputRef.current?.click();
                    }
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-[#2a3942] transition-colors"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    option.type === 'document' && "bg-[#7f66ff]",
                    option.type === 'camera' && "bg-[#ff6b9d]",
                    option.type === 'image' && "bg-[#bf59cf]",
                    option.type === 'contact' && "bg-[#0eabf4]",
                    option.type === 'location' && "bg-[#1fa855]",
                    option.type === 'sticker' && "bg-[#ffbb44]"
                  )}>
                    <option.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[#e9edef] text-xs">{option.label}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'document')}
        />

        {/* Message Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[44px] max-h-[120px] bg-[#2a3942] border-none text-[#e9edef] placeholder:text-[#8696a0] rounded-lg resize-none focus-visible:ring-0 py-3 px-4"
            rows={1}
          />
        </div>

        {/* Send / Record Button */}
        {message.trim() ? (
          <Button
            onClick={handleSend}
            disabled={disabled}
            size="icon"
            className="bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-full w-11 h-11 flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            onClick={() => setIsRecording(!isRecording)}
            size="icon"
            className={cn(
              "rounded-full w-11 h-11 flex-shrink-0 transition-colors",
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-transparent hover:bg-transparent text-[#8696a0] hover:text-[#e9edef]"
            )}
          >
            <Mic className="w-6 h-6" />
          </Button>
        )}
      </div>
    </div>
  );
}