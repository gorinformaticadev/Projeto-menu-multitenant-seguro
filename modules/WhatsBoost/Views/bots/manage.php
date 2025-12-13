<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <div class="card">
        <div class="page-title clearfix rounded">
            <div class="d-flex justify-content-between align-items-center">
                <h1><?php echo app_lang($type.'_bots'); ?></h1>
                <?php $permission_type = ('message' == $type) ? 'wb_create_mb' : 'wb_create_tb'; ?>
                <?php if (check_wb_permission($user, $permission_type)) { ?>
                    <div class="title-button-group">
                        <a href="<?php echo get_uri('whatsboost/bots/'.$type); ?>" class="btn btn-primary"><i data-feather='plus-circle' class='icon-16'></i> <?php echo app_lang($type.'_bots'); ?></a>
                    </div>
                <?php } ?>
            </div>
        </div>
        <div class="table-responsive">
            <table id="bot_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
    "use strict";

    $(function() {
        $("#bot_table").appTable({
            source: '<?php echo_uri("whatsboost/bots/table/$type"); ?>',
            columns: [{
                    title: '#'
                },
                {
                    title: '<?php echo app_lang('name'); ?>'
                },
                {
                    title: '<?php echo app_lang('type'); ?>'
                },
                {
                    title: '<?php echo app_lang('trigger'); ?>'
                },
                {
                    title: '<?php echo app_lang('relation_type'); ?>'
                },
                {
                    title: '<?php echo app_lang('active'); ?>'
                },
                {
                    title: '<?php echo app_lang('action'); ?>',
                    class: "text-center option w175"
                },
            ],
            order: [
                [0, "desc"]
            ],
            printColumns: [0, 1, 2, 3, 4, 5, 6],
            xlsColumns: [0, 1, 2, 3, 4, 5, 6]
        });

        $(document).on('change', '#active_deactive_bot', function(event) {
            status = 0;
            if ($(this).prop("checked") === true) {
                status = 1;
            }
            $.ajax({
                url: '<?php echo_uri('whatsboost/bots/active_deactive_bot'); ?>',
                type: 'post',
                data: {
                    id: $(this).data('id'),
                    status: status,
                    type: '<?php echo $type; ?>'
                },
                dataType: 'json'
            }).done(function(res) {
                appAlert.success(res.message, {
                    duration: 2000
                });
            });
        });

        $(document).on('click', '.bot_clone_btn', function(event) {
            $.ajax({
                url: '<?php echo_uri('whatsboost/bots/clone_bot') ?>',
                type: 'post',
                dataType: 'json',
                data: {
                    id   : $(this).data('id'),
                    type : $(this).data('bot_type'),
                }
            }).done(function(response) {
                console.log(response);
                if (response.type == 'success') {
                    appAlert.success(response.message, {
                        duration: 4000
                    });
                } else {
                    appAlert.error(response.message, {
                        duration: 4000
                    });
                }
                setTimeout(() => {
                    window.location = response.redirect_url;
                }, 4000);
            });
        });
    });
</script>
