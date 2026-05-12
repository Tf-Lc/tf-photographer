// ===== 导航栏滚动效果 =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// 移动端菜单切换
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  // 汉堡菜单动画
  const spans = navToggle.querySelectorAll('span');
  navToggle.classList.toggle('active');
});

// 点击导航链接后关闭移动菜单
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

// ===== 作品集筛选 =====
const filterBtns = document.querySelectorAll('.filter-btn');
const galleryItems = document.querySelectorAll('.gallery-item');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // 更新按钮状态
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;

    galleryItems.forEach(item => {
      if (filter === 'all' || item.dataset.category === filter) {
        item.classList.remove('hidden');
        item.style.animation = 'fadeIn 0.4s ease forwards';
      } else {
        item.classList.add('hidden');
      }
    });
  });
});

// ===== 灯箱功能 =====
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxDesc = document.getElementById('lightboxDesc');
const lightboxClose = document.getElementById('lightboxClose');

galleryItems.forEach(item => {
  item.addEventListener('click', () => {
    const img = item.querySelector('.gallery-img');
    const title = item.querySelector('h3').textContent;
    const desc = item.querySelector('p').textContent;

    // 从 background-image 提取 URL 并替换为大图
    const bgUrl = img.style.backgroundImage;
    const url = bgUrl.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
    // 使用更大尺寸的图片
    const largeUrl = url.replace(/\/\d+\/\d+$/, '/1600/1200');

    lightboxImg.src = largeUrl;
    lightboxTitle.textContent = title;
    lightboxDesc.textContent = desc;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  });
});

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// ===== 滚动动画 =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// 为需要动画的元素添加 fade-in 类
document.querySelectorAll(
  '.about-image, .about-text, .gallery-item, .contact-item, .qr-card'
).forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// ===== CSS 动画关键帧（通过 JS 注入） =====
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
`;
document.head.appendChild(style);
