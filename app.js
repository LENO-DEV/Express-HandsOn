const path = require('path');
const express = require('express');
const cors = require('cors');
const app = express();
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const AppError = require('./Classes/appError.js');
const { errorfunction } = require('./Controllers/errorHandleController.js');
const compression = require('compression');
// Routes................................
const View_Router = require('./Routes/View_Routes');
const Tour_Router = require('./Routes/Tour_Routes');
const User_Router = require('./Routes/User_Routes');
const Review_Router = require('./Routes/Review_Routes');
const BookingRouter = require('./Routes/Booking_Routes');
app.use(cors());

// GLOBAL Middlewares for Express...................

// 1) for HTTP header 
app.use(helmet({
      contentSecurityPolicy: false
}));


app.set('view engine', 'pug');
app.set('views', path.join(`${__dirname}`, 'views'));
//for all static files
app.use(express.static(path.join(__dirname, 'public')));



// 2) for Cookie sending and parsing...........
app.use(cookieParser());

// 3) For Parsing data on req.body......................
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data Santization against NoSQL query injection..........
app.use(mongoSanitize());


// Data Santization for XSS(for html code)..........
app.use(xss());

// Prevent paramete pollution............
app.use(hpp());

app.use(compression());
const limiter = rateLimit({
      max: 6,
      windowMs: 60 * 60 * 1000,
      message: 'Too many Request from this IP! Please try again in an hour!'
});
// For Rate limiting for APIs.
app.use('/api/v1/users/login', limiter);
app.use('/api/v1/users/signup', limiter);

// Routes Mounting .................................
app.use('/api/v1/tours', Tour_Router);
app.use('/api/v1/users', User_Router);
app.use('/api/v1/review', Review_Router);
app.use('/api/v1/bookings', BookingRouter);
app.use('/', View_Router);




// Error for no correct URL...................................
app.all('/*/', (req, res, next) => {
      next(new AppError(`No such ${req.originalUrl} request to proceed!`, 404));
});

// Global errorhandle middleware........................
app.use(errorfunction);

module.exports = app;
