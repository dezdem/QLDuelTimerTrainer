/*******************************************************
 * String.Format 1.0 - JScript аналог C# String.Format
 *
 * Copyright (c) 2010, Dema (Dema.ru)
 * Лицензия LGPL для любого использования
 *
 *******************************************************/

// Инициализация форматирования
(function(st)
{
	// Собственно сам метод форматирования, параметров можно задавать много
	// Использовать так: var str = "Строка формата {0}, использование форматирования {1:формат}".format(some1, some2);
	st.format					= function()
	{
		if(arguments.length==0) return this;
		// RegExp для поиска меток
		var placeholder			= /\{(\d+)(?:\:([^(^}]+)(?:\(((?:\\\)|[^)])+)\)){0,1}){0,1}\}/g;
		var args				= arguments;
		// Одним проходом ищем, форматируем и вставляем вместо меток
		return this.replace(placeholder, function(m, num, f, params){
			m					= args[Number(num)];	// берем значение по номеру
			f					= formatters[f];		// пытаемся определить функцию форматирования
			return f==null?m:f(m, pp((params || '').replace(/\\\)/g, ')').replace(/\\,/g, '\0').split(','), args) );
		});
	};
	// Реализация форматирования "как в C#": var str = String.Format(format, arg0[, arg1[, arg2 ...]]);
	String.Format				= function(format)
	{
		return arguments.length<=1?format:st.format.apply(format, Array.prototype.slice.call(arguments, 1));
	};
	// Добавить формат
	// name    - имя, которое будет использоваться в форматировании
	// func    - функция форматирования, принимает 2 параметра: значение и параметры для форматирования
	// replace - для замены уже зарегистрированного форматирования нужно передать true
	st.format.add				= function(name, func, replace)
	{
		if(formatters[name]!=null && replace!=true) throw 'Format '+name+' exist, use replace=true for replace';
		formatters[name]		= func;
	};
	// Получить функцию форматирования по имени
	st.format.get				= function(name)
	{
		return formatters[name];
	};
	///////// PRIVATE /////////
	// RegExp для поиска ссылок на параметры в форматировании
	var paramph					= /^\{(\d+)\}$/;
	// Набор форматирований
	var formatters				= {};
	// Поиск меток в параметрах форматирования и замена их на значения
	function pp(params, args)
	{
		var r;
		for(var i=0; i<params.length; i++)
		{
			if( (r = paramph.exec(params[i])) != null )
				params[i]		= args[Number(r[1])];				// Параметр - метка
			else
				params[i]		= params[i].replace(/\0/g, ',');	// Параметр - не метка
		}
		return params;
	}
	///////// ОПЯТЬ PUBLIC /////////
	// Регистрируем форматирование массивов.
	//   первый параметр - разделитель (необязательный)
	//   второй параметр - имя формата для применения к каждому элементу (необязательный)
	//   третий и далее  - соответственно параметры формата каждого элемента
	st.format.add('arr', function arr(va, params)
	{
		if(va==null) return 'null';
		var v					= [];									// Результат
		var j					= params.shift() || '';					// Разделитель
		var f					= formatters[params.shift()];			// Формат элемента
		if(f==null)
			v					= va;									// Нет формата элемента - возвращаем исходный массив
		else 
			for(var i=0; i<va.length; i++) v.push(f(va[i], params));	// Применяем формат к каждому элементу
		return v.join(j);												// Вернуть результат
	});
})(String.prototype);

// Набор расширений для форматирования чисел:
// :n                 - вывод числа как есть, если пришла запись типа 1.032434e+34, то вид будет без использования e+xx
// :n(x,y)            - вывод с дополнением целой части до x символов, дробной части до y символов, дробная часть обрезается до указанного размера
// :nb(b)             - вывод числа с указанным основанием (для вывода двоичной записи и т.п.)
// :nf(loc,n1,n2,...) - вывод ед. измерения для числа в нужной форме
(function(format)
{
	// Регистрируем форматирование
	// Функция форматирования числа с нужным количеством знаков до и после запятой
	format.add('n', function n(v, params)
	{
		if((v = numformat.exec(v))==null) return 'NaN';		// Уточняем момент насчет числа
		var e					= Number(v[4]);				// Порядок (если указан)
		return isNaN(e)?
					''.concat(v[1], addz(null, v[2], params[0]), addz('.', v[3], params[1])):	// нет порядка - форматируем, что есть
					shift(v[1], v[2], v[3], e, params[0], params[1]);							// форматирование с учетом порядка
	});
	// Функция форматирования числа в любой системе (от 2-ой до ....)
	format.add('nb', function nb(v, params)
	{
		v						= Number(v);
		if(isNaN(v)) return 'NaN';
		var b					= Number(params[0]);
		return  addz(null, v.toString(isNaN(b)?16:b), Number(params[1]));
	});
	// Функция вывода ед. измерения для числа в нужной форме
	format.add('nf', function(v, params)
	{
		v						= Number(v);
		if(isNaN(v)) return 'NaN';
		var f					= nforms[params[0].toLowerCase()];
		return f==null?params[0]+'?':f(v, params);
	});
	// Регистрация функции вычисления формы для нужной локали
	format.get('nf').add		= function(lname, func)
	{
		nforms[lname.toLowerCase()]		= func;
	};
	///////// PRIVATE /////////
	// RegExp для числа
	var numformat				= /^([+-]?)(\d+)(?:\.(\d+))?(?:\s*e([+-]\d+))?$/i;
	// Строка для заполнения нужным количеством нулей
	var zz						= '0000000000';
	// Список функций вычисления нужных форм (рубль, рубля, рублей и т.п.)
	var nforms					= {
		en:						function(v, params)
		{
			return params[v==1?1:2];
		},
		ru:						function(v, params)
		{
			var v10				= v%10;
			var v100			= v%100;
			return params[v10==1 && v100!=11?1:v10>=2 && v10<=4 && (v100<10 || v100>=20)?2:3];
		}
	};
	// Разбираемся с нужным количеством разрадов
	function addz(pre, v, l)
	{
		if(isNaN(l = Number(l==''?undefined:l))) return (v==null || v=='')?'':((pre || '')+v);	// Нет ограничений - просто вернем то, что есть
		if((v = v || '').length>=l)	return pre==null?v:(pre+v.substr(0, l));		// Значение больше нужного - целую часть оставляем, дробную режем
		return pre==null?(getz(l-v.length)+v):(pre+v+getz(l-v.length));				// Значение меньше нужного - дополняем нулями с соответствующей стороны
	}
	// Получить нужное количество нулей
	function getz(l)
	{
		while(zz.length<l) zz += zz;
		return zz.substring(0, l);
	}
	// Форматирование со сдвигом на нужное кол-во разрядов
	function shift(s, i, f, e, li, lf)
	{
		var m;
		if(e>0)			// перенос из дробной в целую
		{
			m					= addz('', f, e);
			i					+= m;
			f					= f.substr(m.length);
		}else if(e<0)	// перенос из целой в дробную
		{
			m					= i.length-(-e);
			f					= (m>0?i.substring(m, i.length):(getz(-m)+i)) + f;
			i					= (m>0?i.substring(0, -e-1):    '0');
		}
		// Тут нет e==0 - с нулями сюда не ходят!
		return ''.concat(s, addz(null, i, li), addz('.', f, lf));
	}
})(String.prototype.format);

// Набор расширений для форматирования дат и времени
(function(format)
{
	// Форматирование даты+времени в строку.
	// :df         - используется родное преобразование в строку
	// :df(формат) - используется указанный формат, где нужно указывать:
	//               yyyy или yy - год
	//               M или MM    - месяц   (один или 2 знака)
	//               d или dd    - день    (один или 2 знака)
	//               H или HH    - часы    (один или 2 знака)
	//               m или mm    - минуты  (один или 2 знака)
	//               s или ss    - секунды (один или 2 знака)
	//               f           - миллисекунды (количество букв f - нужное количество знаков)
	format.add('df', df);
	// Определяем короткую запись для некоторых форматов
	format.add('d',	 function(v, p){ return df(v, intf.d); });
	format.add('dt', function(v, p){ return df(v, p[0]=='nosec'?intf.dt:intf.dts); });
	format.add('t',  function(v, p){ return df(v, p[0]=='nosec'?intf.t :intf.ts ); });

	// Форматирование времени счетчика:
	// работает с объектом Date или целым числом - количеством мсек,
	// выводит строку типа 1дн. 2час. 3мин. 4сек. 5мс, значения, равные нулю пропускаются
	// :ts(min|sec|msec) - на чем остановиться: min - до минут (дни+часы+минуты), sec - до секунд, msec - до мс (по-умолчанию)
	format.add('ts', function ts(v, params)
	{
		if(v==null) return 'null';
		if(v==0)	return '0';
		var s					= [];							// Результат
		var round				= params[0];					// Параметр вывода
		// Пошли обрабатывать... Может переписать с вложением...?
		v						= tss(v, 1000, s, 'мс', w = (round=='' || round=='msec') );
		v						= tss(v, 60, s, 'сек.', w = (w || round=='sec') );
		v						= tss(v, 60, s, 'мин.', w = (w || round=='min') );
		v						= tss(v, 24, s, 'час.', true);
		if(v!=0) s.unshift(v, 'дн.');							// Не забываем вывести дни, если они есть
		return s.join(' ');										// Результат!
	});
	///////// PRIVATE /////////
	// Кэш функций форматирования даты+время
	var c						= {};
	// Опять строка для заполнения нужным количеством нулей
	var zz						= '0000';
	// Часто используемые форматы
	var intf					= { d: ['dd.MM.yyyy'], dts: ['dd.MM.yyyy HH:mm:ss'], dt: ['dd.MM.yyyy HH:mm'], t: ['HH:mm'], ts: ['HH:mm:ss'] };
	// RegExp поиска меток форматирования даты+времени
	var fpre					= /yyyy|yy|m{1,2}|d{1,2}|H{1,2}|M{1,2}|s{1,2}|f{1,4}/g;
	// Чем заменяются метки форматирования
	var fp						= {	y: 'v.getFullYear()', 
									M: 'v.getMonth()+1', 
									d: 'v.getDate()', 
									H: 'v.getHours()', 
									m: 'v.getMinutes()', 
									s: 'v.getSeconds()', 
									f: 'v.getMilliseconds()'
								};
	function df(v, p)
	{
		if(v==null) return 'null';
		p						= p.join(',');				// Должен остаться один МакКлауд!
		if(p=='') return v;									// Нет формата - делать нечего
		var f					= c[p];						// Пытаемся получить функцию из кэша...
		if(f==null)											// ...облом-с - будем компилировать!
		{	// Строим исходник функции форматирования
			f					= 'return \'\'.concat(\''+
								  (p
									.replace(/'/g, '\\\'')
									.replace(fpre, function(m){
										var mc		= m.charAt(0);
										return mc=='y'?
												''.concat('\', ', fp[mc], ', \''):
												''.concat('\', a(', fp[mc], ', ', m.length, '), \'');
									})
								  )+
								  '\');';
			f					= new Function('v', 'a', f);// Компиляция, так сказать
			c[p]				= f;						// Загоняем в кэш
		}
		return f(v, addz);									// Форматирование!
	}
	// Добавление нужного количества нулей
	function addz(v, l)
	{
		return zz.substring(0, l-(''+v).length)+v;
	}
	// Шаг обработки вывода времени счетчика
	function tss(dt, div, buf, msn, write)
	{
		if(dt==0) return 0;						// Нуль - валим
		var i					= dt % div;		// Остаток от деления
		if(i!=0 && write) buf.unshift(i, msn);	// Выводим, если нужно
		return Math.floor(dt / div);			// Вернем секвестированное число
	}
})(String.prototype.format);
