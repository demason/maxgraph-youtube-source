const burger = document?.querySelector('[data-burger]');
const nav = document?.querySelector('[data-nav]');
const navItems = nav?.querySelectorAll('a');
const body = document.body;
const header = document?.querySelector('.header');
const headerHeight = header.offsetHeight;
document.querySelector(':root').style.setProperty('--header-height', `${headerHeight}px`);

const mobile = window.matchMedia('(max-width: 1024px)');

const setMenuOpen = (open) => {
  const isOpen = mobile.matches && open;
  body.classList.toggle('stop-scroll', isOpen);
  burger.classList.toggle('burger--active', isOpen);
  nav.classList.toggle('nav--visible', isOpen);
  nav.inert = mobile.matches && !isOpen;
  burger.setAttribute('aria-expanded', String(isOpen));
  burger.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
};

const resetMenu = () => {
  const focusInNav = nav.contains(document.activeElement);
  const focusOnBurger = document.activeElement === burger;
  setMenuOpen(false);

  if (mobile.matches && focusInNav) {
    burger.focus();
  } else if (!mobile.matches && focusOnBurger) {
    navItems[0]?.focus();
  }
};

resetMenu();
mobile.addEventListener('change', resetMenu);

burger?.addEventListener('click', () => {
  const open = burger.getAttribute('aria-expanded') !== 'true';
  setMenuOpen(open);
  if (mobile.matches && open) navItems[0]?.focus();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false);
    burger.focus();
  }
});

navItems.forEach(el => {
  el.addEventListener('click', () => {
    if (mobile.matches) {
      setMenuOpen(false);
      burger.focus();
    }
  });
});
