const login = async (email, password) => {
    try {
        const res = await axios({
            method: 'post',
            url: '/api/v1/users/login',
            data: {
                email: email,
                C_password: password
            }
        });
        if (res.data.status === 'Success') {
            alert('Login Successfully');
            window.setTimeout(() => {
                location.assign('/');
            }, 1500);
        }
    } catch (error) {
        alert("Incoreet Email and Pasword!");
    }
}

document.querySelector('.login--form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    login(email, password);
});
