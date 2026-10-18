export const money=(minor:number,currency='USD')=>new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'USD',maximumFractionDigits:2}).format((minor||0)/100);
