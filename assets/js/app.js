// Hamburger Menu Selection
var burger = document.querySelector("#burger-menu");
var ul = document.querySelector(".navbar");

// Scroll To Top Button Selection
var scrollToTop = document.getElementById('sctop')

// Nav Links Selection
var skills = document.getElementById('skills')
var project = document.getElementById('projects')
var contact = document.getElementById('contacts')



// Scroll To Top Functionality
scrollToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
});

// Nav Links Scroll Functionality
skills.addEventListener('click', ()=>{
    window.scrollTo({
        top: 650,
        left: 0,
        behavior: "smooth",
    });
});
project.addEventListener('click', ()=>{
    window.scrollTo({
        top: 1200,
        left: 0,
        behavior: "smooth",
    });
});
contact.addEventListener('click', ()=>{
    window.scrollTo({
        top: 1600,
        left: 0,
        behavior: "smooth",
    });
});


// Toggle Nav Function
burger.addEventListener("click", () => {
    ul.classList.toggle("show");
});
