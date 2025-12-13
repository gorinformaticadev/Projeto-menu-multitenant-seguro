<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <div class="card">
        <div class="page-title clearfix rounded">
            <div class="d-flex justify-content-between align-items-center">
                <h1><?php echo app_lang('campaign'); ?></h1>
                <?php if (check_wb_permission($user, 'wb_create_campaign')) { ?>
                    <div class="title-button-group">
                        <a href="<?php echo get_uri('whatsboost/campaigns/campaign'); ?>" class="btn btn-primary"><i data-feather='plus-circle' class='icon-16'></i> <?php echo app_lang('send_new_campaign'); ?></a>
                    </div>
                <?php } ?>
            </div>
        </div>
        <div class="table-responsive">
            <table id="campaign_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
    "use strict";
    $(function() {
        $("#campaign_table").appTable({
            source: '<?php echo_uri('whatsboost/table'); ?>',
            columns: [{
                    title: '#'
                },
                {
                    title: '<?php echo app_lang('campaign_name'); ?>'
                },
                {
                    title: '<?php echo app_lang('template'); ?>'
                },
                {
                    title: '<?php echo app_lang('relation_type'); ?>'
                },
                {
                    title: '<?php echo app_lang('total'); ?>'
                },
                {
                    title: '<?php echo app_lang('delivered_to'); ?>'
                },
                {
                    title: '<?php echo app_lang('read_by'); ?>'
                },
                {
                    title: '<?php echo app_lang('action'); ?>',
                    class: "text-center option w175"
                },
            ],
            order: [
                [0, "desc"]
            ],
            printColumns: [0, 1, 2, 3, 4, 5, 6, 7],
            xlsColumns: [0, 1, 2, 3, 4, 5, 6, 7]
        });
    })
</script>
