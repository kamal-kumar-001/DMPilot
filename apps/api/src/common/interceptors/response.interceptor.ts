import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@dmpilot/types';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    // Machine-to-machine FeeFree delivery requires the exact signed-event ACK contract.
    if (Reflect.getMetadata('rawWebhookAck', context.getHandler())) return next.handle();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data === undefined ? null : data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
