export function positiveInt(n, max = 10000000) {
 if (!Number.isSafeInteger(n) || n <= 0 || n > max) throw new Error('Invalid positive integer');
 return n;
}
export function transfer(sender, receiver, price, quantity) {
 const cost = positiveInt(price) * positiveInt(quantity, 99);
 if (!Number.isSafeInteger(cost) || cost > sender) throw new Error('Insufficient coins');
 return {sender: sender - cost, receiver: receiver + cost, cost};
}
export function salaryAmount(diamonds, minimum, dailyPaisa) {
 positiveInt(minimum); positiveInt(dailyPaisa);
 if (!Number.isSafeInteger(diamonds) || diamonds < minimum) throw new Error('Daily target not reached');
 return dailyPaisa;
}
export function dhakaDay(now = new Date()) {
 return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Dhaka', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
}
