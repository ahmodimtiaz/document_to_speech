import eventlet
eventlet.monkey_patch()

from app import app, socketio

# Use the Flask app directly as the WSGI application
# SocketIO will work through the extension registered with the app
application = app