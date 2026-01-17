import React from 'react';
import { cn } from "@/lib/utils";
import { 
  Check, 
  CheckCheck, 
  Clock,
  Download,
  Play,
  FileText,
  MapPin
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const getStatusIcon = (status) => {
  switch(status) {
    case 'sent': return <Check className="w-3.5 h-3.5 text-[#8696a0]" />;
    case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />;
    case 'read': return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
    case 'pending': return <Clock className="w-3.5 h-3.5 text-[#8696a0]" />;
    case 'failed': return <span className="text-xs text-red-400">!</span>;
    default: return null;
  }
};

const ImageMessage = ({ url, caption }) => (
  <div className="max-w-[280px]">
    <img 
      src={url} 
      alt="Imagem" 
      className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
    />
    {caption && <p className="mt-1 text-sm">{caption}</p>}
  </div>
);

const VideoMessage = ({ url, caption }) => (
  <div className="max-w-[280px] relative">
    <div className="relative rounded-lg overflow-hidden bg-black/20">
      <video src={url} className="max-w-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
          <Play className="w-6 h-6 text-white ml-1" />
        </div>
      </div>
    </div>
    {caption && <p className="mt-1 text-sm">{caption}</p>}
  </div>
);

const AudioMessage = ({ url, isFromMe }) => (
  <div className="flex items-center gap-3 min-w-[200px]">
    <button className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
      <Play className="w-4 h-4 text-white ml-0.5" />
    </button>
    <div className="flex-1">
      <div className="h-1 bg-[#8696a0]/30 rounded-full">
        <div className="h-full w-0 bg-[#8696a0] rounded-full" />
      </div>
      <span className="text-xs text-[#8696a0] mt-1">0:00</span>
    </div>
  </div>
);

const DocumentMessage = ({ filename, url }) => (
  <div className="flex items-center gap-3 p-2 rounded-lg bg-black/10 min-w-[200px]">
    <div className="w-10 h-10 rounded-lg bg-[#00a884] flex items-center justify-center flex-shrink-0">
      <FileText className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{filename || 'Documento'}</p>
      <p className="text-xs text-[#8696a0]">PDF</p>
    </div>
    <a href={url} download className="p-2 hover:bg-black/10 rounded-full transition-colors">
      <Download className="w-4 h-4" />
    </a>
  </div>
);

const LocationMessage = ({ latitude, longitude, address }) => (
  <div className="min-w-[200px]">
    <div className="h-[120px] bg-[#202c33] rounded-lg flex items-center justify-center">
      <MapPin className="w-8 h-8 text-[#00a884]" />
    </div>
    {address && <p className="mt-1 text-sm text-[#8696a0]">{address}</p>}
  </div>
);

export default function MessageBubble({ message, showDate }) {
  const isFromMe = message.is_from_me;
  const time = message.timestamp ? format(parseISO(message.timestamp), 'HH:mm') : '';

  const renderContent = () => {
    switch(message.type) {
      case 'image':
        return <ImageMessage url={message.media_url} caption={message.content} />;
      case 'video':
        return <VideoMessage url={message.media_url} caption={message.content} />;
      case 'audio':
        return <AudioMessage url={message.media_url} isFromMe={isFromMe} />;
      case 'document':
        return <DocumentMessage filename={message.media_filename} url={message.media_url} />;
      case 'location':
        return <LocationMessage address={message.content} />;
      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  return (
    <div className={cn(
      "flex mb-1",
      isFromMe ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[65%] rounded-lg px-3 py-2 relative",
        isFromMe 
          ? "bg-[#005c4b] text-[#e9edef]" 
          : "bg-[#202c33] text-[#e9edef]"
      )}>
        {/* Quoted message */}
        {message.quoted_content && (
          <div className={cn(
            "mb-2 p-2 rounded border-l-4 text-xs",
            isFromMe 
              ? "bg-[#004438] border-[#06cf9c]" 
              : "bg-[#1d282f] border-[#00a884]"
          )}>
            <p className="text-[#8696a0] truncate">{message.quoted_content}</p>
          </div>
        )}

        {renderContent()}
        
        <div className={cn(
          "flex items-center gap-1 mt-1 justify-end",
          message.type === 'text' ? "-mb-1" : ""
        )}>
          <span className="text-[10px] text-[#8696a0]">{time}</span>
          {isFromMe && getStatusIcon(message.status)}
        </div>
      </div>
    </div>
  );
}