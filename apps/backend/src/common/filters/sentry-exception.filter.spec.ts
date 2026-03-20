jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { SentryExceptionFilter } from './sentry-exception.filter';

describe('SentryExceptionFilter', () => {
  it('does not try to write a second response when headers were already sent', () => {
    const filter = new SentryExceptionFilter();
    const response = {
      headersSent: true,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      method: 'GET',
      url: '/api/system/dashboard',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new HttpException('already handled', HttpStatus.REQUEST_TIMEOUT),
      host,
    );

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
