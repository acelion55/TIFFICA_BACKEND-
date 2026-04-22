const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-delivery';

// Store active connections
const connections = new Map(); // partnerId -> ws connection
const adminConnections = new Set();

function initializeWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/delivery' });
  
  wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection');
    
    let partnerId = null;
    let isAdmin = false;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        // Handle authentication
        if (data.type === 'auth') {
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET);
            partnerId = decoded.partnerId;
            
            if (partnerId) {
              connections.set(partnerId, ws);
              console.log(`✅ Partner ${partnerId} authenticated via WebSocket`);
              
              ws.send(JSON.stringify({
                type: 'auth_success',
                message: 'Connected successfully'
              }));
            }
          } catch (err) {
            ws.send(JSON.stringify({
              type: 'auth_error',
              message: 'Invalid token'
            }));
          }
        }
        
        // Handle admin authentication
        if (data.type === 'admin_auth') {
          // TODO: Verify admin token
          isAdmin = true;
          adminConnections.add(ws);
          console.log('✅ Admin authenticated via WebSocket');
        }
        
        // Handle location updates
        if (data.type === 'location_update' && partnerId) {
          const { latitude, longitude, deliveryId } = data;
          
          // Broadcast to admin
          broadcastToAdmins({
            type: 'partner_location',
            partnerId,
            latitude,
            longitude,
            deliveryId,
            timestamp: new Date()
          });
          
          console.log(`📍 Location update from partner ${partnerId}: ${latitude}, ${longitude}`);
        }
        
        // Handle status updates
        if (data.type === 'status_update' && partnerId) {
          const { deliveryId, status } = data;
          
          // Broadcast to admin
          broadcastToAdmins({
            type: 'delivery_status',
            partnerId,
            deliveryId,
            status,
            timestamp: new Date()
          });
          
          console.log(`📦 Status update from partner ${partnerId}: ${status}`);
        }
        
      } catch (err) {
        console.error('❌ WebSocket message error:', err);
      }
    });
    
    ws.on('close', () => {
      if (partnerId) {
        connections.delete(partnerId);
        console.log(`🔌 Partner ${partnerId} disconnected`);
      }
      if (isAdmin) {
        adminConnections.delete(ws);
        console.log('🔌 Admin disconnected');
      }
    });
    
    ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err);
    });
  });
  
  console.log('✅ WebSocket server initialized on /ws/delivery');
  
  return wss;
}

// Send message to specific partner
function sendToPartner(partnerId, data) {
  const ws = connections.get(partnerId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

// Broadcast to all admins
function broadcastToAdmins(data) {
  adminConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

// Notify partner about new delivery
function notifyNewDelivery(partnerId, delivery) {
  return sendToPartner(partnerId, {
    type: 'new_delivery',
    delivery,
    timestamp: new Date()
  });
}

// Notify partner about delivery assignment
function notifyDeliveryAssigned(partnerId, delivery) {
  return sendToPartner(partnerId, {
    type: 'delivery_assigned',
    delivery,
    timestamp: new Date()
  });
}

module.exports = {
  initializeWebSocket,
  sendToPartner,
  broadcastToAdmins,
  notifyNewDelivery,
  notifyDeliveryAssigned
};
