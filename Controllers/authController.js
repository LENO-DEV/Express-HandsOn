const User = require('../models/User_models');
const AppError = require('../Classes/appError');
const jwt = require('jsonwebtoken');
const Email = require('../Classes/emailMailer');
const crypto = require('crypto');

const getToken = async (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN
	});
}

const verificationtoken = async (token, secret) => {
	return jwt.verify(token, secret);
}

exports.signup = async (req, res, next) => {
	try {
		const user = await User.create(req.body);
		const url = `${req.protocol}://${req.get('host')}/me`;
		await new Email(user, url).sendWelcome();

		const token = await getToken(user._id);
		const cookieOptions = {
			expires: new Date(Date.now() + 3600 * 1000),
			httpOnly: true
		};
		res.cookie('loginjwt', token, cookieOptions);
		res.status(200).json({
			status: "Success",
			U_token: token
		});
	} catch (error) {
		if (error.code == 11000) return next(new AppError('Email Already exist', 501));
		if (error.errors.password) return next(new AppError(`${error.errors.password.message}`, 501));
		if (error.errors.confirmPassword) return next(new AppError(`${error.errors.confirmPassword.message}`, 501));
		return next(new AppError(`${error}`, 501));
	}
}

exports.login = async (req, res, next) => {
	try {
		const { email, C_password } = req.body;
		if (!email || !C_password) {
			return next(new AppError('Please provide Email and Password!', 404));
		}
		const loginuser = await User.findOne({ email, Active: { $ne: false } }).select('+password');
		// const correct = ; // return true or false
		if (!loginuser || !await loginuser.correctPassword(C_password, loginuser.password)) {
			return next(new AppError(`Incorrect email or password`, 501));
		}
		const token = await getToken(loginuser._id);
		const cookieOptions = {
			expires: new Date(Date.now() + 3600 * 1000),
			httpOnly: true
		};
		// console.log(cookieOptions);
		res.cookie('loginjwt', token, cookieOptions);
		res.status(200).json({
			status: "Success",
			U_token: token
		});
	} catch (error) {
		return next(new AppError(`${error}`, 404));
	}
}


exports.logout = (req, res, next) => {
	res.cookie('loginjwt', 'loggedOut', {
		expires: new Date(Date.now() + 2 * 60 * 1000),
		httpOnly: true
	});
	return next();
};

exports.protect = async (req, res, next) => {
	try {
		// 1) getting token and checks it there.............
		let verifyToken;

		if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
			verifyToken = req.headers.authorization.split(' ')[1];
			// console.log(verifyToken);
		} else if (req.cookies.loginjwt) {
			verifyToken = req.cookies.loginjwt;
		}


		if (!verifyToken) {
			return next(new AppError(`Logined Failed! Please try again to get access.`, 401));
		}
		// 2.) Verification Token .........................................
		const decode = await verificationtoken(verifyToken, process.env.JWT_SECRET);

		// 3.) Check if user still exists................................
		const CurrentUser = await User.findById(decode.id);           //finding single ID......
		if (!CurrentUser) {
			return next(new AppError(`User doesn't exists longer!`, 401));
		}

		// 4.) Check if user changed password after token created
		if (CurrentUser.changePasswordAfter(decode.iat)) {
			return next(new AppError(`User recently changed password! Please login Again`, 401));
		}
		// Grant Access to Protected Route......................
		req.user = CurrentUser;
		res.locals.user = CurrentUser;
		next();

	} catch (error) {
		if (error.name === "JsonWebTokenError") {
			return next(new AppError(`Invalid Token ID, Please login to get access.`, 401));
		}
		if (error.name === "TokenExpiredError") {
			return next(new AppError(`Token Expires, Please login to get access`, 401));
		}
		else {
			return next(new AppError(`${error}`, 404));
		}
	}
}

exports.restrict = (...roles) => { // Closure // We cannot pass arguments to a middleware function..... so for that we need an arbutarty method...  
	return (req, res, next) => { //middlware function........
		// roles is an array like ['admin'] 
		if (!roles.includes(req.user.role)) { //roles is accessed beacause of Closure (Lexial scoping)........
			return next(new AppError(`You are not authorized to do this actions`, 403));
		}
		console.log(req.user.role);
		next();
	}
}

exports.forgotpassword = async (req, res, next) => {
	var user;
	try {
		// 1) get user based on posted Email 
		const { email } = req.body;
		user = await User.findOne({ email });
		if (!user) {
			return next(new AppError(`There is no user with this email`, 500));
		}

		// 2) Generate random token.....
		const resetToken = await user.createPasswordResetToken();
		await user.save({ validateBeforeSave: false });

		// // 3) send it via email 
		let resetURL = '';
		if (process.env.NODE_ENV = 'production') {
			resetURL = `${req.protocol}://${req.get('host')}/resetPasswordSent/${resetToken}`;
		} else {
			resetURL = `${req.protocol}://${req.get('host')}/api/v1/user/resetPasswordSent/${resetToken}`;
		}

		await new Email(user, resetURL).sendPasswordReset();
		res.status(200).json({
			status: 'Success',
			message: 'Token sent to email!'
		});

	} catch (error) {
		user.passwordResetToken = undefined;
		user.passwordResetExpires = undefined;
		await user.save({ validateBeforeSave: false })
		return next(new AppError(`${error}`, 500));
	}
}


exports.resetPassowrd = async (req, res, next) => {
	try {
		// 1) Get user based on token..............
		const hashedToken = crypto
			.createHash('sha256')
			.update(req.params.token)
			.digest('hex');
		console.log(req.params.token);
		const userRequest = await User.findOne(
			{
				passwordResetToken: hashedToken,
				passwordResetExpires: { $gt: Date.now() }
			});

		// 2) if token has not expired and there is new user 
		if (!userRequest) {
			return next(new AppError(`Token is Invalid or expired!`, 501));
		}

		userRequest.password = req.body.password;
		userRequest.confirmPassword = req.body.confirmpass;
		userRequest.passwordResetToken = undefined;
		userRequest.passwordResetExpires = undefined;
		await userRequest.save();

		const token = await getToken(userRequest._id);
		res.status(200).json({
			status: "Success",
			U_token: token,
			result: userRequest
		});
		// 3) update changed password 


	} catch (error) {
		if (error.errors.password) return next(new AppError(`${error.errors.password.message}`, 501));
		if (error.errors.confirmPassword) return next(new AppError(`${error.errors.confirmPassword.message}`, 501));
		return next(new AppError(`${error}`, 501))
	}
}


exports.updatePassword = async (req, res, next) => {
	try {
		const currentUser = await User.findById(req.user._id).select('+password');
		if (!(await currentUser.correctPassword(req.body.currentPassword, currentUser.password))) {
			return next(new AppError(`Your current password is wrong! Try Again`, 501));
		}
		currentUser.password = req.body.password;
		currentUser.confirmPassword = req.body.passwordConfirm;
		await currentUser.save();

		const createSendToken = await getToken(currentUser._id);
		const cookieOptions = {
			expires: new Date(Date.now() + 1000 * 1000),
			httpOnly: true
		};

		res.cookie('loginjwt', createSendToken, cookieOptions);
		res.status(200).json({
			message: 'Success',
			token: createSendToken,
			data: currentUser
		});

	} catch (error) {
		if (error.errors.confirmPassword) return next(new AppError(`${error.errors.confirmPassword.message}`, 501));
		if (error.errors.password) return next(new AppError(`${error.errors.password.message}`, 501));
		if (error) return next(new AppError(`${error}`, 501));
	}
}

// Check only for render pages..................
exports.isLoggedIn = async (req, res, next) => {
	try {
		if (req.cookies.loginjwt) {
			// 2.) Verification Token .........................................
			const decode = await verificationtoken(
				req.cookies.loginjwt,
				process.env.JWT_SECRET
			);

			// 3.) Check if user still exists................................
			const CurrentUser = await User.findById(decode.id);           //finding single ID......
			if (!CurrentUser) {
				return next();
			}

			// 4.) Check if user changed password after token created
			if (CurrentUser.changePasswordAfter(decode.iat)) {
				return next();
			}

			// There is a logined in USER..................
			req.userexist = CurrentUser;
			res.locals.user = CurrentUser;
		}
		next();
	}
	catch (error) {
		return next();
	}
}
