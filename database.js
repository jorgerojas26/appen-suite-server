import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to database');
});

mongoose.connection.on('error', err => {
    console.log('Mongoose connection error: ' + err);
});
