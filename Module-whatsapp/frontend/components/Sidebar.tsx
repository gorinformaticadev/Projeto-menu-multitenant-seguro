import React from 'react';
import { cn } from "@/lib/utils";
import { 
  MessageSquare, 
  Phone, 
  Clock, 
  Users, 
  UserPlus,
  Bot,
  Settings,
  CircleDot
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const menuItems = [
  { icon: MessageSquare, label: 'Conversas', id: 'chats' },
  { icon: Phone, label: 'Chamadas', id: 'calls' },
  { icon: Clock, label: 'Status', id: 'status' },
  { icon: Users, label: 'Comunidades', id: 'communities' },
  { icon: UserPlus, label: 'Contatos', id: 'contacts' },
  { icon: Bot, label: 'Meta AI', id: 'meta-ai' },
];

export default function Sidebar({ activeMenu, onMenuChange, unreadCount = 0, connectionStatus = 'disconnected' }) {
  const getStatusColor = () => {
    switch(connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'qr_ready': return 'bg-blue-500 animate-pulse';
      default: return 'bg-red-500';
    }
  };

  return (
    <div className="hidden md:flex w-16 bg-[#202c33] flex-col items-center py-3 border-r border-[#2a3942]">
      <TooltipProvider delayDuration={100}>
        {/* Logo / Status */}
        <div className="mb-6 relative">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#202c33]", getStatusColor())} />
        </div>

        {/* Menu Items */}
        <div className="flex-1 flex flex-col gap-1">
          {menuItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onMenuChange(item.id)}
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all relative group",
                    activeMenu === item.id 
                      ? "bg-[#2a3942] text-[#00a884]" 
                      : "text-[#8696a0] hover:bg-[#2a3942]/50 hover:text-[#e9edef]"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.id === 'chats' && unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-[#00a884] text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#e9edef] text-[#111b21] border-none">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Bottom Items */}
        <div className="flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onMenuChange('settings')}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                  activeMenu === 'settings'
                    ? "bg-[#2a3942] text-[#00a884]"
                    : "text-[#8696a0] hover:bg-[#2a3942]/50 hover:text-[#e9edef]"
                )}
              >
                <Settings className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#e9edef] text-[#111b21] border-none">
              Configurações
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}