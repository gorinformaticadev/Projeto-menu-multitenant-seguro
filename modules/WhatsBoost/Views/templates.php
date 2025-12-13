<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <div class="card">
        <div class="page-title clearfix rounded">
            <h1><?php echo app_lang('whatsapp_template_details'); ?></h1>
            <div class="title-button-group">
                <?php if (check_wb_permission($user, 'wb_load_template')) { ?>
                    <a href="javascript:void(0)" title="" class="btn btn-primary loadTemplates"><?php echo app_lang('load_templates'); ?></a>
                <?php } ?>
                <a href="https://business.facebook.com/wa/manage/message-templates/" title="" class="btn btn-primary"><?php echo app_lang('template_management'); ?></a>
            </div>
        </div>
        <div class="table-responsive">
            <table id="templates_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
    "use strict";
    $(function() {
        $("#templates_table").appTable({
            source: '<?php echo_uri('whatsboost/template/get_table_data'); ?>',
            columns: [{
                    title: '#'
                },
                {
                    title: '<?php echo app_lang('template_name'); ?>'
                },
                {
                    title: '<?php echo app_lang('language'); ?>'
                },
                {
                    title: '<?php echo app_lang('category'); ?>'
                },
                {
                    title: '<?php echo app_lang('template_type'); ?>'
                },
                {
                    title: '<?php echo app_lang('status'); ?>'
                },
                {
                    title: '<?php echo app_lang('body_data'); ?>'
                },
            ],
            printColumns: [0, 1, 2, 3, 4, 5],
            xlsColumns: [0, 1, 2, 3, 4, 5]
        });

        $('.loadTemplates').on('click', function(event) {
            event.preventDefault();
            $.ajax({
                url: '<?php echo_uri('whatsboost/template/load_templates'); ?>',
                type: 'GET',
                dataType: 'JSON',
            }).done(function(res) {
                if (res.success == true) {
                    appAlert.success(res.message, {
                        duration: 10000
                    });
                } else {
                    appAlert.error(res.message, {
                        duration: 10000
                    });
                }
                $('#templates_table').DataTable().ajax.reload();
            });
        });

    });
</script>
