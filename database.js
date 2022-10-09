import mongoose from 'mongoose';

mongoose.connect('mongodb://mongo:27017/appen-suite');

mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to database');
});

mongoose.connection.on('error', err => {
    console.log('Mongoose connection error: ' + err);
});
