const items=[
 {id:"vip",name:"Статус VIP",category:"status",icon:"✦",description:"Особая отметка в профиле, цветной ник и дополнительные настройки оформления.",price:"Цена будет объявлена"},
 {id:"premium",name:"Статус Premium",category:"status",icon:"◆",description:"Расширенное оформление профиля и дополнительные косметические опции.",price:"Цена будет объявлена"},
 {id:"wardrobe",name:"Гардероб",category:"style",icon:"◈",description:"Уникальные комплекты одежды и аксессуары, не влияющие на характеристики.",price:"Цена будет объявлена"},
 {id:"vehicle-style",name:"Стиль автомобиля",category:"style",icon:"▰",description:"Эксклюзивные визуальные варианты окраски, дисков и декоративных элементов.",price:"Цена будет объявлена"},
 {id:"nickname",name:"Смена имени",category:"service",icon:"✎",description:"Однократная смена игрового имени по правилам сервера.",price:"Цена будет объявлена"},
 {id:"slot",name:"Дополнительный персонаж",category:"service",icon:"♙",description:"Дополнительный слот персонажа, если это будет поддерживаться игровым аккаунтом.",price:"Цена будет объявлена"}
];
const root=document.querySelector("#products"),count=document.querySelector("#count");
function render(filter="all"){const shown=items.filter(x=>filter==="all"||x.category===filter);count.textContent=shown.length+" предложений";root.innerHTML=shown.map(x=>`<article class="product"><div class="product-icon" aria-hidden="true">${x.icon}</div><h3>${x.name}</h3><p>${x.description}</p><div class="product-bottom"><span class="price">${x.price}</span><span class="soon">Скоро</span></div></article>`).join("");}
document.querySelectorAll(".filter").forEach(button=>button.addEventListener("click",()=>{document.querySelector(".filter.active")?.classList.remove("active");button.classList.add("active");render(button.dataset.filter)}));render();