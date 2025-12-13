<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <div class="card">
        <div class="page-title clearfix rounded">
            <div class="d-flex justify-content-between align-items-center">
                <h1><?php echo app_lang('wb_log_details'); ?></h1>
                <?php if (check_wb_permission($user, 'wb_clear_log')) { ?>
                    <div class="title-button-group">
                        <a href="<?php echo get_uri('whatsboost/clear_log'); ?>" class="btn btn-danger text-nowrap"><?php echo app_lang('clear_log'); ?></a>
                    </div>
                <?php } ?>
            </div>
        </div>
        <div class="table-responsive">
            <table id="whatsboost_log_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>
<script type="text/javascript">
    "use strict";
    $(document).ready(function() {
        $("#whatsboost_log_table").appTable({
            source: '<?php echo_uri('whatsboost/log_table'); ?>',
            columns: [{
                    title: '#'
                },
                {
                    title: '<?php echo app_lang('category'); ?>'
                },
                {
                    title: '<?php echo app_lang('name'); ?>'
                },
                {
                    title: '<?php echo app_lang('template_name'); ?>'
                },
                {
                    title: '<?php echo app_lang('response_code'); ?>'
                },
                {
                    title: '<?php echo app_lang('type'); ?>'
                },
                {
                    title: '<?php echo app_lang('recorded_on'); ?>'
                },
                {
                    title: '<?php echo app_lang('actions'); ?>',
                    'class': 'text-center option'
                }
            ],
            order: [
                [0, "desc"]
            ],
            printColumns: [0, 1, 2, 3, 4, 5, 6],
            xlsColumns: [0, 1, 2, 3, 4, 5, 6],
        });
    });
</script>
