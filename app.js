// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const firebaseAdmin = require('firebase-admin');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios').default;
const api = require('fetchmini');
// import firebase from 'firebase/app';
// import 'firebase/auth';

const serviceAccount = require('./chatmates-71273-firebase-adminsdk-tlrdx-f7aab2e0de.json'); // Replace with your Firebase service account key path
const webApiKey = 'AIzaSyDAhONniAnoK8eZurSgeZcxx2LpWU14TP4';
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount)
});

const db = firebaseAdmin.firestore();

app.use(bodyParser.json());
app.use(cors());

app.post('/api/messages', async (req, res) => {
  try {
    console.log("inside api");
    const { sender, message } = req.body;

    // Store message in Firebase Firestore
    await db.collection('messages').add({
      sender,
      message,
      timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, message: 'Message stored successfully' });
  } catch (error) {
    console.error('Error storing message:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/getMessages', async (req, res) => {
  try {
    console.log("inside api");

    // Retrieve messages from Firebase Firestore
    const querySnapshot = await db.collection('messages').get();

    // Check if there are any messages
    if (!querySnapshot.empty) {
      // Extract messages from the query snapshot
      const messages = [];
      querySnapshot.forEach((doc) => {
        messages.push(doc.data());
      });

      // Send the messages as a response
      res.status(200).json({ success: true, messages: messages });
    } else {
      // Send a response indicating no messages found
      res.status(404).json({ success: false, message: 'No messages found' });
    }
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.post('/login', async (req, res) => {
  try {
    console.log("inside api");
    const { user, pass } = req.body;
    // Retrieve messages from Firebase Firestore
    const payload = {
      email: user,
      password: pass,
      returnSecureToken: true
    };
    console.log(payload);
    // Make a POST request with payload and headers
    await api.post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDAhONniAnoK8eZurSgeZcxx2LpWU14TP4', payload)
    .then(response => {
      console.log('Response:', response);
      res.status(200).json({ success: true, userDetails: response });
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(200).json({ success: false, messages: error.error.message });
    });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/validateuser', async (req, res) => {
  try {
    // Extract the access token from the request body
    // console.log(req);
    const { accessToken } = req.body;

    // Make a POST request to Firebase Authentication API to verify the access token
    const firebaseResponse = await api.post(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyDAhONniAnoK8eZurSgeZcxx2LpWU14TP4`, {
      idToken: accessToken,
      returnSecureToken: true
    });
    console.log(firebaseResponse.users[0].providerUserInfo);
    // If verification is successful, return the user details
    res.status(200).json({ success: true, userDetails: firebaseResponse.users[0].providerUserInfo });
  } catch (error) {
    console.error('Error validating user:', error);

    // If verification fails, return an error response
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/signup', async (req, res) => {
  try {
    console.log("inside api");
    const { username, email, pass } = req.body;
    // Retrieve messages from Firebase Firestore
    const payload = {
      displayName: username,
      email: email,
      password: pass,
      returnSecureToken: true
    };
    console.log(payload);
    // Make a POST request with payload and headers
    await api.post('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyDAhONniAnoK8eZurSgeZcxx2LpWU14TP4', payload)
    .then(response => {
      console.log('Response:', response);
      res.status(200).json({ success: true, userDetails: response });
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(400).json({ success: false, messages: error.error.message });
    });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Store connected clients
const clients = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Store the socket object for future use
  clients[socket.id] = socket;

  // Broadcast new connections to all clients
  io.emit('userConnected', socket.id);

  // Listen for chat messages from clients
  socket.on('message', async (message) => {
    console.log('Message received:', message);

    try {
      // Save message to Firestore
      await db.collection('messages').add({
        sender: socket.id,
        message: message,
        timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      });

      // Broadcast the message to all connected clients
      io.emit('message', { sender: socket.id, message: message });
    } catch (error) {
      console.error('Error saving message to Firestore:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Remove the client from the clients object
    delete clients[socket.id];
    // Broadcast disconnections to all clients
    io.emit('userDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
