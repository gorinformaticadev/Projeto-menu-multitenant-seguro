import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshCw, Smartphone, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

// URL do Backend (ajustar conforme ambiente)
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function QRCodeScanner({
  onRefresh,
  onDisconnect
}: { onRefresh?: () => void, onDisconnect?: () => void }) {
  const [countdown, setCountdown] = useState(60);
  const [status, setStatus] = useState<string>('connecting');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Conecta ao namespace /whatsapp do backend
    const newSocket = io(`${SOCKET_URL}/whatsapp`, {
      transports: ['websocket'],
      query: {
        // Em produção, isso deve vir do contexto de auth
        tenantId: 'demo-tenant'
      }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected');
      // Solicita início da sessão assim que conecta
      newSocket.emit('start_session');
    });

    newSocket.on('qr_code', (qr) => {
      setQrCodeData(qr);
      setStatus('qr_ready');
      setCountdown(60);
    });

    newSocket.on('connection_status', (data) => {
      console.log('Status update:', data);
      setStatus(data.status); // 'connected', 'disconnected'
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (status === 'qr_ready' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && status === 'qr_ready') {
      // Solicita novo QR se expirar (se o backend suportar refresh explicito ou apenas reconectar)
      socket?.emit('start_session');
    }
  }, [countdown, status, socket]);

  const handleManualRefresh = () => {
    socket?.emit('start_session');
    onRefresh?.();
  };

  const handleDisconnectSession = () => {
    // Implementar logout no backend se necessário
    socket?.disconnect();
    onDisconnect?.();
  };

  return (
    <div className="min-h-screen bg-[#111b21] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#202c33] border-[#2a3942] text-[#e9edef]">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00a884] flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Conectar ao WhatsApp</CardTitle>
          <CardDescription className="text-[#8696a0]">
            Escaneie o QR Code com seu celular para conectar
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {status === 'connecting' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 text-[#00a884] animate-spin" />
              <p className="text-[#8696a0]">Iniciando sessão...</p>
            </div>
          )}

          {status === 'connected' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-green-400 font-medium">Conectado com sucesso!</p>
              <Button
                onClick={handleDisconnectSession}
                variant="destructive"
                className="mt-4"
              >
                Desconectar
              </Button>
            </div>
          )}

          {status === 'disconnected' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-400">Desconectado</p>
              <Button
                onClick={handleManualRefresh}
                className="mt-4 bg-[#00a884] hover:bg-[#00a884]/90"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          )}

          {status === 'qr_ready' && qrCodeData && (
            <>
              <div className="bg-white p-4 rounded-lg mx-auto w-fit">
                <QRCodeSVG
                  value={qrCodeData}
                  size={256}
                  level={"L"}
                />
              </div>

              <div className="text-center space-y-2">
                <p className="text-[#8696a0] text-sm">
                  O QR Code expira em <span className="text-[#00a884] font-medium">{countdown}s</span>
                </p>
                <Button
                  onClick={handleManualRefresh}
                  variant="ghost"
                  size="sm"
                  className="text-[#00a884] hover:text-[#00a884]/80 hover:bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar QR Code
                </Button>
              </div>

              <div className="bg-[#182229] rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Como conectar:</p>
                <ol className="text-sm text-[#8696a0] space-y-2 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em <strong className="text-[#e9edef]">Mais opções</strong> ou <strong className="text-[#e9edef]">Configurações</strong></li>
                  <li>Toque em <strong className="text-[#e9edef]">Aparelhos conectados</strong></li>
                  <li>Toque em <strong className="text-[#e9edef]">Conectar aparelho</strong></li>
                  <li>Aponte seu celular para esta tela para escanear o QR code</li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
