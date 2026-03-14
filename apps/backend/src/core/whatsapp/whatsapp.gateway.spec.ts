import { WhatsAppGateway } from './whatsapp.gateway';

describe('WhatsAppGateway websocket toggle', () => {
  const createGateway = (websocketEnabled = true) => {
    const websocketRuntimeToggleService = {
      isEnabledCached: jest.fn().mockResolvedValue(websocketEnabled),
    };

    return {
      gateway: new WhatsAppGateway(websocketRuntimeToggleService as any),
      websocketRuntimeToggleService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects whatsapp websocket connections when the channel is disabled', async () => {
    const { gateway } = createGateway(false);
    const client = {
      id: 'whatsapp-socket-1',
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as any);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('returns an explicit disabled state for whatsapp realtime handlers when the channel is disabled', async () => {
    const { gateway } = createGateway(false);
    const client = {
      id: 'whatsapp-socket-2',
      disconnect: jest.fn(),
    };

    await expect(gateway.handleSendMessage(client as any, {})).resolves.toEqual({
      status: 'disabled_by_configuration',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('keeps the prepared gateway behavior when the channel is enabled', async () => {
    const { gateway } = createGateway(true);
    const client = {
      id: 'whatsapp-socket-3',
      disconnect: jest.fn(),
    };

    await expect(gateway.handleJoinRoom(client as any, {})).resolves.toEqual({
      status: 'prepared',
    });
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});
