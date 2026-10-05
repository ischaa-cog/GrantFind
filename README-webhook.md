# User Registration Webhook Implementation

## Overview

The GrantFind application now includes webhook functionality that automatically sends user registration details to a configured webhook URL whenever a new user signs up.

## Configuration

### Environment Variable

Set the following environment variable in your Replit project:

```
USER_REGISTRATION_WEBHOOK_URL=https://your-domain.com/webhook-endpoint
```

### Webhook Payload

When a user registers, the following JSON payload is sent via POST request:

```json
{
  "event": "user.registered",
  "timestamp": "2025-01-31T17:32:00Z",
  "data": {
    "user": {
      "id": 123,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

### Request Headers

- `Content-Type: application/json`
- `User-Agent: GrantFind/1.0`

## Testing

### Admin Panel

1. Navigate to `/admin` in the application (accessible via sidebar)
2. Go to the "Webhooks" tab
3. Enter a test webhook URL (you can use webhook.site for testing)
4. Click "Test" to send a test payload

### Webhook Testing Services

For testing, you can use these free services:

1. **webhook.site** - Get a unique URL and see real-time requests
2. **requestbin.com** - Similar webhook testing service
3. **ngrok** - For testing with local servers

### Example Test Setup

1. Go to https://webhook.site
2. Copy the unique URL provided
3. In GrantFind admin panel, paste the URL and click "Test"
4. Check webhook.site to see the received payload
5. Set the URL as `USER_REGISTRATION_WEBHOOK_URL` environment variable
6. Test actual user registration to see webhook in action

## Implementation Details

### Files Modified

- `server/webhook.ts` - New webhook service with send functions
- `server/routes.ts` - Added webhook integration to registration route
- `client/src/components/webhook-settings.tsx` - Admin UI component
- `client/src/pages/admin.tsx` - Admin panel page

### Error Handling

- Webhook failures are logged but don't affect user registration
- Failed webhook attempts are logged to console
- Network timeouts and HTTP errors are handled gracefully

### Security Considerations

- Webhook URLs should use HTTPS in production
- Consider implementing webhook signature verification
- Rate limiting may be needed for high-volume registrations
- Sensitive user data should be filtered if needed

## Monitoring

Check server logs for webhook delivery status:

```
User registration webhook sent successfully for user: user@example.com
```

Or error messages:

```
Webhook failed with status 500: Internal Server Error
Error sending user registration webhook: Network timeout
```

## Future Enhancements

1. **Webhook Signatures**: Implement HMAC signatures for security
2. **Retry Logic**: Add automatic retry for failed webhook deliveries
3. **Multiple Webhooks**: Support multiple webhook endpoints
4. **Event Filtering**: Allow filtering which events trigger webhooks
5. **Delivery Status**: Track and display webhook delivery status in admin panel