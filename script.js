// JavaScript Document

// smooth scroll
$(function(){
	$('a[href^="#"]').click(function(){
		var speed = 500;
		var href= $(this).attr("href");
		var target = $(href == "#" || href == "" ? 'html' : href);
		var position = target.offset().top;
		$("html, body").animate({scrollTop:position}, speed, "swing");
		return false;
	});
});

// gnav open-close
$(function() {
		$('.gnav_btn').on('click', function() {
			$('.gnav_btnline').toggleClass('active');
			$('.gnav').slideToggle(600);
		});
});

// acordion
$(function(){
	$(".acordion_btn").on("click", function() {
		$(this).next().slideToggle();
		$(this).toggleClass('open');
	});
});

// gnav acordion
$(function(){
	var windowSm = 1119;
	$(".gnav_acordion_btn").on("click", function() {
		var windowWidth = $(window).width();
		if (windowWidth <= windowSm) {
			$(this).next().slideToggle();
		}
	});
});



$(window).on('load resize', function(){
  var winW = $(window).width();
  var devW = 1199;
  if (winW >= devW) {
	$(window).scroll(function () {           /* 繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺輔ｌ縺滓凾 */
		var pos = $('.main').offset();          /* mv繧帝℃縺弱◆main繧ｿ繧ｰ縺ｮ鬮倥＆繧貞叙蠕励＠縺ｦ螟画焚[pos]縺ｫ譬ｼ邏� */
		if ($(this).scrollTop() > pos.top) {   /* 螟画焚[pos]繧医ｊ縲√せ繧ｯ繝ｭ繝ｼ繝ｫ縺輔ｌ縺ｦ縺�◆繧� */
			$('.pcheader').fadeIn();                /* 繝倥ャ繝繝ｼ繧偵�繧上▲縺ｨ陦ｨ遉ｺ */
		} else {                               /* 縺昴ｌ莉･螟悶�蝣ｴ蜷� */
			$('.pcheader').fadeOut();               /* 繝倥ャ繝繝ｼ繧偵�繧上▲縺ｨ髱櫁｡ｨ遉ｺ */
		}
	});
  }
});
