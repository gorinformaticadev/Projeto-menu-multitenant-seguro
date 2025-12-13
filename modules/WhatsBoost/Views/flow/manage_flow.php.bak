<link rel="stylesheet" href="<?php echo base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/css/botflow.css?v=' . get_setting('app_version')); ?>">
<div id="wrapper">
    <div class="content">
        <?php echo form_open(get_uri("whatsboost/save_flow"), array("id" => "prompt-form", "class" => "prompt-form", "role" => "form"), ['id' => $flow['id'] ?? '', 'flow_data' => $flow['flow_data'], 'is_validate' => '0', 'file_url' => base_url('files/whatsboost/flow' . '/' . $flow['id'] ?? '' . '/')]); ?>
        <div id="new-vue-id"></div>
        <?php echo form_close(); ?>
    </div>
</div>
<script>
    var image_path = '<?php echo base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/images/'); ?>';
    var allowed_extension = '<?= json_encode(wbGetAllowedExtension()); ?>';
    var media_file_uri = '<?php echo get_uri(); ?>'
</script>
<script src="<?php echo base_url(PLUGIN_URL_PATH . 'WhatsBoost/assets/js/vueflow.bundle.js?v=' . get_setting('app_version')); ?>"></script>

<script>
    $('#workflow-form').on('submit', function(event) {
        event.preventDefault();
    });
    $('#save_btn').click(function(event) {
        event.preventDefault();
        if ($('input[name="is_validate"]').val() == '1') {
            $.ajax({
                url: '<?php echo echo_uri('whatsboost/bot_flow/save'); ?>',
                type: 'post',
                data: {
                    id: $('input[name="id"]').val(),
                    flow_data: $('input[name="flow_data"]').val(),
                },
                dataType: 'json',
            }).done(function(res) {
                appAlert.success(res.type, res.message, {
                    duration: 2000
                });
                setTimeout(() => {
                    location.href = '<?php echo echo_uri('whatsboost/bot_flow'); ?>';
                }, 1000);
            })
        }
    });
</script>