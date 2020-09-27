const getDevError = (error, res) => {
      res.status(error.statusCode).json({
            status: error.status,
            message: error.message,
            stack: error.stack
      });
}

const getProdError = (error, res) => {
      res.status(error.statusCode).render('error', {
            title: 'Not found!',
            message: `${error.statusCode} | ${error.message} 😠`
      });
}


module.exports.errorfunction = (error, req, res, next) => {
      error.status = error.status || 'error';
      error.statusCode = error.statusCode || 500;

      if (process.env.NODE_ENV === "development") {
            getDevError(error, res);
      }
      else if (process.env.NODE_ENV === "production") {
            if (error.message === 'JsonWebTokenError') {
                  error.message = 'Login Failed! Try again!'
                  getProdError(error, res)
            }
            getProdError(error, res);
      }
}

